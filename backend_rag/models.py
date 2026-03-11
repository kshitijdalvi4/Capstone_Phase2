from pydantic import BaseModel, EmailStr
from typing import List, Optional

class QueryRequest(BaseModel):
    query: str
    chat_history: Optional[List[dict]] = []

class QueryResponse(BaseModel):
    answer: str
    sources: Optional[List[str]] = []

# Authentication Models
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar: str
    recentActivity: List[dict] = []
    skillDistribution: List[dict] = []

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

# Code Execution Models
class TestCaseInput(BaseModel):
    input: str
    expected_output: str

class CodeExecutionRequest(BaseModel):
    code: str
    language: str = "python"
    method_name: Optional[str] = None
    test_cases: List[TestCaseInput] = []

class TestCaseResult(BaseModel):
    input: str
    expected_output: str
    actual_output: str
    passed: bool
    error: Optional[str] = None
    runtime: float = 0.0
    memory: float = 0.0

class CodeExecutionResponse(BaseModel):
    success: bool
    results: List[TestCaseResult] = []
    error: Optional[str] = None
    metric_runtime_ms: float = 0.0
    metric_memory_kb: float = 0.0

class LeetCodeRequest(BaseModel):
    title_slug: str

class LeetCodeResponse(BaseModel):
    success: bool
    problem: Optional[dict] = None
    error: Optional[str] = None

class PredictionRequest(BaseModel):
    userId: str
    problemId: str

class PredictionResponse(BaseModel):
    success_probability: float
    recommendation: str
    confidence: str
    error: Optional[str] = None

class CodeAnalysisRequest(BaseModel):
    code: str
    language: str
    problem_title: str
    problem_description: str
    optimal_time_complexity: str
    optimal_space_complexity: str

class CodeAnalysisResponse(BaseModel):
    success: bool
    insights: List[str] = []
    error: Optional[str] = None
