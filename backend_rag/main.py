from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from models import QueryRequest, QueryResponse, UserSignup, UserLogin, TokenResponse, UserResponse, CodeExecutionRequest, CodeExecutionResponse, TestCaseResult, CodeAnalysisRequest, CodeAnalysisResponse
from graph import app_graph
from auth import create_user, get_user_by_email, verify_password, create_access_token
from executor import PythonExecutor, CppExecutor, JavaExecutor
from leetcode_service import LeetCodeService
import uvicorn
import os
import sys
import pickle
import numpy as np
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Kshitij Capstone AI Agent")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI")
client = AsyncIOMotorClient(MONGO_URI)
db = client.get_default_database(default="test") # Fallback to test if unspecified
users_collection = db["users"]
problems_collection = db["display-problems"]
interactions_collection = db["interactions"]

print(f"STARTUP: Connected to DB: {db.name}")
print(f"STARTUP: Collections: {users_collection.name}, {problems_collection.name}")

# Load ML Model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "ml_models", "success_predictor_model.pkl")
model = None
try:
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    print("Success Predictor Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")

# Mapping Logic
DIFFICULTY_MAP = {"Easy": 1, "Medium": 2, "Hard": 3}
EXPERIENCE_MAP = {"Beginner": 1, "Intermediate": 2, "Advanced": 3}

async def calculate_features(user_id: str, problem_id: str):
    print(f"DEBUG: Searching for user_id={user_id}, problem_id={problem_id}")
    user = await users_collection.find_one({"userId": user_id})
    problem = await problems_collection.find_one({"id": problem_id})
    
    if not user:
        print(f"DEBUG: User {user_id} not found")
        return None
    if not problem:
        print(f"DEBUG: Problem {problem_id} not found")
        return None

    print(f"DEBUG: Found user {user.get('email')} and problem {problem.get('title')}")
    interactions = await interactions_collection.find({"userId": user_id}).sort("createdAt", -1).limit(5).to_list(length=5)
    
    # 1. userRating
    user_rating = user.get("userRating", 1200)
    
    # 2. accuracy
    accuracy = user.get("accuracy", 0.0)
    
    # 3. solvedProblems
    solved_problems = user.get("solvedProblems", 0)
    
    # 4. experience
    exp_str = user.get("experience", "Beginner")
    experience = EXPERIENCE_MAP.get(exp_str, 1)
    
    # 5. skillMatch
    skill_dist = user.get("skillDistribution", [])
    p_tags = problem.get("tags", [])
    if not skill_dist or not p_tags:
        skill_match = 0.1
    else:
        skill_map = {s["name"]: s["level"] for s in skill_dist if "name" in s and "level" in s}
        levels = [skill_map.get(tag, 0.0) for tag in p_tags]
        skill_match = float(np.mean(levels)) if levels else 0.1
        
    # 6. difficulty
    diff_str = problem.get("difficulty", "Medium")
    difficulty = DIFFICULTY_MAP.get(diff_str, 2)
    
    # 7. acceptanceRate
    ar_raw = problem.get("acceptanceRate")
    acceptance_rate = (ar_raw if ar_raw is not None else 50.0) / 100.0
    
    # 8. timeTakenNorm (Average time across last interactions, normalized by 1200s/20m)
    if interactions:
        avg_time = np.mean([i.get("timeTakenSeconds", 300) for i in interactions])
        time_taken_norm = min(avg_time / 1200.0, 1.0)
    else:
        time_taken_norm = 0.5
        
    # 9. recentSuccessRate (Last 5 interactions)
    if interactions:
        successes = sum([1 for i in interactions if i.get("submissionStatus") == 1])
        recent_success_rate = successes / len(interactions)
    else:
        recent_success_rate = accuracy
        
    # 10. difficultyGap (User Rating - Problem Expected Rating)
    # Estimate bench: Easy=1000, Medium=1400, Hard=1800
    expected_rating = 1000 + (difficulty - 1) * 400
    difficulty_gap = user_rating - expected_rating
    
    return {
        "userRating": user_rating,
        "accuracy": accuracy,
        "solvedProblems": solved_problems,
        "experience": experience,
        "skillMatch": skill_match,
        "difficulty": difficulty,
        "acceptanceRate": acceptance_rate,
        "timeTakenNorm": time_taken_norm,
        "recentSuccessRate": recent_success_rate,
        "difficultyGap": difficulty_gap
    }

@app.post("/api/predict-success")
async def predict_success(request: dict):
    user_id = request.get("userId")
    problem_id = request.get("problemId")
    
    if not user_id or not problem_id:
        raise HTTPException(status_code=400, detail="userId and problemId required")
        
    features = await calculate_features(user_id, problem_id)
    if not features:
        raise HTTPException(status_code=404, detail="User or Problem not found")
        
    if not model:
        return {"success": False, "error": "Model not loaded"}
        
    X = pd.DataFrame([features])
    prob = model.predict_proba(X)[0][1]
    
    return {"success": True, "probability": round(float(prob), 4)}

@app.post("/api/predict-all-success")
async def predict_all_success(request: dict):
    user_id = request.get("userId")
    if not user_id:
        raise HTTPException(status_code=400, detail="userId required")
        
    user = await users_collection.find_one({"userId": user_id})
    import time
    start_time = time.time()
    
    # Fetch all problems
    problems_cursor = problems_collection.find({}, {"id": 1, "difficulty": 1, "acceptanceRate": 1, "tags": 1})
    problems_list = await problems_cursor.to_list(length=3000)
    
    if not problems_list:
        return {"success": False, "error": "No problems found"}

    # Shared user features
    user_rating = user.get("userRating", 1200)
    accuracy = user.get("accuracy", 0.0)
    solved_problems = user.get("solvedProblems", 0)
    experience = EXPERIENCE_MAP.get(user.get("experience", "Beginner"), 1)
    skill_dist = user.get("skillDistribution", [])
    skill_map = {s["name"]: s["level"] for s in skill_dist if "name" in s and "level" in s}
    
    # Interactions for dynamic features
    interactions = await interactions_collection.find({"userId": user_id}).sort("createdAt", -1).limit(5).to_list(length=5)
    if interactions:
        avg_time = np.mean([i.get("timeTakenSeconds", 300) for i in interactions])
        time_taken_norm = min(avg_time / 1200.0, 1.0)
        successes = sum([1 for i in interactions if i.get("submissionStatus") == 1])
        recent_success_rate = successes / len(interactions)
    else:
        time_taken_norm = 0.5
        recent_success_rate = accuracy

    df = pd.DataFrame(problems_list)
    
    # 1. Base Features
    df['difficulty_num'] = df['difficulty'].map(DIFFICULTY_MAP).fillna(2)
    df['acceptanceRate'] = df['acceptanceRate'].fillna(50.0) / 100.0
    
    # 2. Skill Match (apply is fine for ~3k rows, but optimized)
    def compute_skill_match(tags):
        if not skill_map or not tags or not isinstance(tags, list):
            return 0.1
        levels = [skill_map.get(tag, 0.0) for tag in tags]
        return float(sum(levels) / len(levels)) if levels else 0.1

    df['skillMatch'] = df['tags'].apply(compute_skill_match)
    
    # 3. User Features (Broadcasting)
    df['userRating'] = user_rating
    df['accuracy'] = accuracy
    df['solvedProblems'] = solved_problems
    df['experience'] = experience
    df['timeTakenNorm'] = time_taken_norm
    df['recentSuccessRate'] = recent_success_rate
    
    # 4. Difficulty Gap
    # expected_rating = 1000 + (difficulty - 1) * 400
    df['expected_rating'] = 1000 + (df['difficulty_num'] - 1) * 400
    df['difficultyGap'] = df['userRating'] - df['expected_rating']
    
    # Final X for model
    # Note: Model expects "difficulty" as the numerical column
    X = df[[
        "userRating", "accuracy", "solvedProblems", "experience", 
        "skillMatch", "difficulty_num", "acceptanceRate", 
        "timeTakenNorm", "recentSuccessRate", "difficultyGap"
    ]]
    X.columns = [
        "userRating", "accuracy", "solvedProblems", "experience", 
        "skillMatch", "difficulty", "acceptanceRate", 
        "timeTakenNorm", "recentSuccessRate", "difficultyGap"
    ]
    
    if model is None:
        print("WARNING: Model not loaded. Using Heuristic Fallback for success prediction.")
        # gap_factor = difficultyGap / 1000 (clamped -0.3 to 0.3)
        gap_factor = (df['difficultyGap'] / 1000.0).clip(-0.3, 0.3)
        acc_factor = (accuracy - 0.5) * 0.2
        skill_factor = (df['skillMatch'] - 0.5) * 0.2
        probs = 0.5 + gap_factor + acc_factor + skill_factor
        probs = probs.clip(0.01, 0.99)
    else:
        # Use simple NumPy array for prediction to avoid scikit-learn feature name warnings
        X_values = X.values
        probs = model.predict_proba(X_values)[:, 1]
    
    result_map = {pid: round(float(p), 4) for pid, p in zip(df['id'], probs)}
    
    end_time = time.time()
    print(f"PERF: Calculated {len(df)} scores in {end_time - start_time:.4f}s (ML Model: {model is not None})")
    
    return {"success": True, "scores": result_map}

@app.get("/")
async def root():
    return {"message": "Kshitij Capstone AI Agent API is running"}

# Authentication Endpoints
@app.post("/api/signup", response_model=TokenResponse)
async def signup(user_data: UserSignup):
    # Check if user already exists
    existing_user = get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists.")
    
    # Create new user
    user = create_user(user_data.name, user_data.email, user_data.password)
    
    # Create JWT token
    token = create_access_token({"id": user["id"], "email": user["email"]})
    
    # Return user without password
    user_response = UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        avatar=user["avatar"],
        recentActivity=user.get("recentActivity", []),
        skillDistribution=user.get("skillDistribution", [])
    )
    
    return TokenResponse(token=token, user=user_response)

@app.post("/api/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    # Find user by email
    user = get_user_by_email(credentials.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials.")
    
    # Verify password
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid credentials.")
    
    # Create JWT token
    token = create_access_token({"id": user["id"], "email": user["email"]})
    
    # Return user without password
    user_response = UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        avatar=user["avatar"],
        recentActivity=user.get("recentActivity", []),
        skillDistribution=user.get("skillDistribution", [])
    )
    
    return TokenResponse(token=token, user=user_response)

# Chat Endpoint
@app.post("/chat", response_model=QueryResponse)
async def chat(request: QueryRequest):
    try:
        inputs = {
            "question": request.query,
            "chat_history": request.chat_history
        }
        result = app_graph.invoke(inputs)
        return QueryResponse(answer=result["answer"])
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Code Execution Endpoints
executors = {
    "python": PythonExecutor(),
    "cpp": CppExecutor(),
    "java": JavaExecutor()
}

@app.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """Execute user code against test cases using the appropriate executor."""
    executor = executors.get(request.language)
    if not executor:
        return CodeExecutionResponse(success=False, error=f"Language '{request.language}' is not supported yet.")

    try:
        results = executor.execute(request.code, request.test_cases, request.method_name)
        all_passed = all(r.passed for r in results)
        
        # Calculate metrics
        total_runtime = sum(r.runtime for r in results)
        total_memory = sum(r.memory for r in results)
        count = len(results) if results else 1
        
        return CodeExecutionResponse(
            success=all_passed, 
            results=results,
            metric_runtime_ms=round(total_runtime / count, 2),
            metric_memory_kb=round(total_memory / count, 2)
        )
    except Exception as e:
        return CodeExecutionResponse(success=False, error=str(e))

# LeetCode Fetching Endpoint
leetcode_service = LeetCodeService()

@app.post("/api/problems/fetch")
async def fetch_leetcode_problem(request: dict):
    """Fetch problem from LeetCode by title slug."""
    title_slug = request.get("title_slug")
    print(f"Fetching problem for slug: {title_slug}")
    if not title_slug:
        raise HTTPException(status_code=400, detail="title_slug is required")
    
    lc_data = leetcode_service.fetch_problem_details(title_slug)
    if not lc_data:
        raise HTTPException(status_code=404, detail=f"Problem '{title_slug}' not found on LeetCode")
    
    transformed_problem = leetcode_service.transform_to_app_format(lc_data)
    
    # Optionally generate MCQs (mocked for now in the service)
    mcqs = await leetcode_service.generate_mcqs_with_ai(transformed_problem['description'])
    transformed_problem['mcqs'] = mcqs
    
    return {"success": True, "problem": transformed_problem}

# Prediction Endpoint
from prediction_service import prediction_service
from models import PredictionRequest, PredictionResponse

@app.post("/api/predict", response_model=PredictionResponse)
async def predict_success(request: PredictionRequest):
    """Predict user success probability for a problem."""
    result = await prediction_service.predict_success(request.userId, request.problemId)
    return PredictionResponse(
        success_probability=result.get("success_probability", 0.0),
        recommendation=result.get("recommendation", "No recommendation available."),
        confidence=result.get("confidence", "Low"),
        error=result.get("error")
    )

# Code Analysis Endpoint
from code_analysis_service import get_code_analysis

@app.post("/api/analyze-code", response_model=CodeAnalysisResponse)
async def analyze_code(request: CodeAnalysisRequest):
    """Analyze user code against the optimal expected solution using Gemini."""
    try:
        insights = get_code_analysis(
            user_code=request.code,
            language=request.language,
            problem_title=request.problem_title,
            problem_description=request.problem_description,
            optimal_time=request.optimal_time_complexity,
            optimal_space=request.optimal_space_complexity
        )
        return CodeAnalysisResponse(success=True, insights=insights)
    except Exception as e:
        print(f"Error analyzing code: {e}")
        return CodeAnalysisResponse(success=False, error=str(e), insights=[
            "An error occurred during intelligent analysis.", 
            "Please review the optimal solution details above."
        ])

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5002, reload=True)
