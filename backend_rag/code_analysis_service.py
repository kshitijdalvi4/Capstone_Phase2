import os
import json
import google.generativeai as genai

def get_code_analysis(user_code: str, language: str, problem_title: str, problem_description: str, optimal_time: str, optimal_space: str) -> list[str]:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("No API key found for Gemini.")
        return [
            "API Key not configured. Could not generate intelligent summary.",
            "Please review the optimal solution approaches above."
        ]
        
    genai.configure(api_key=api_key)
    
    # We use a standard generative model setup without strictly enforcing JSON schema tools
    # to maintain compatibility with older google-generativeai versions
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""You are an expert technical interviewer and code reviewer.
Analyze the user's code submission for the problem '{problem_title}'.

Problem Description:
{problem_description}

User's Code ({language}):
{user_code}

Optimal Expected Complexity:
Time: {optimal_time}
Space: {optimal_space}

Provide a concise analysis comparing what the user did versus what was optimally expected.
Focus on time/space complexity, data structures used, and the overall approach.
Keep it encouraging but objective.

Respond EXCLUSIVELY with a JSON array of strings containing 3-4 concise insights.
Example format:
[
  "Your approach uses a nested loop resulting in O(n^2) time complexity, while the optimal solution is O(n).",
  "Consider using a Hash Map to store previously seen elements to improve lookup time.",
  "Your space complexity is O(1) which matches the expected optimal space complexity."
]
"""
    
    try:
        response = model.generate_content(prompt)
        text = response.text
        
        # Clean up common markdown formatting from the response
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        insights = json.loads(text.strip())
        
        if not isinstance(insights, list):
            raise ValueError("Response was not a JSON array")
            
        return insights
    except Exception as e:
        print(f"Error in code analysis with google.generativeai: {e}")
        return [
            "An error occurred while analyzing the code.",
            "Please review the optimal solution approaches above.",
            f"Expected Time Complexity: {optimal_time}",
            f"Expected Space Complexity: {optimal_space}"
        ]
