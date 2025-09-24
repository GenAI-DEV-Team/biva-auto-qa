from typing import Dict, List, Tuple, Optional
from app.models.base import Evaluation, Span
from app.services.openai_client import openai_service
from app.services.langfuse import langfuse_service
from app.core.tracing import trace_llm_call
import json
import logging

logger = logging.getLogger(__name__)

class QualityEvaluator:
    def __init__(self):
        self.openai_service = openai_service
        self.langfuse_service = langfuse_service

        # Quality criteria with weights
        self.criteria = {
            "intent": {"weight": 0.10, "description": "Intent Recognition"},
            "fields": {"weight": 0.20, "description": "Field Completeness"},
            "flow": {"weight": 0.15, "description": "Flow Adherence"},
            "admin": {"weight": 0.10, "description": "Administrative Validation"},
            "accuracy": {"weight": 0.10, "description": "Accuracy"},
            "tone": {"weight": 0.05, "description": "Tone"},
            "brevity": {"weight": 0.05, "description": "Brevity"},
            "error_handling": {"weight": 0.05, "description": "Error Handling"},
            "handoff": {"weight": 0.05, "description": "Handoff"},
            "summary": {"weight": 0.10, "description": "Summary"},
            "evidence": {"weight": 0.03, "description": "Evidence"},
            "actions": {"weight": 0.02, "description": "Actions"}
        }

        # Critical violations that automatically mark as bad
        self.critical_violations = [
            "confirming_level_3_administrative_data",
            "promising_money_compensation",
            "incorrect_legal_advice"
        ]

        # Issue severity penalties
        self.issue_penalties = {
            "minor": 5,
            "major": 15,
            "critical": 30
        }

    async def evaluate_span(
        self,
        span: Span,
        context: Dict = None,
        trace=None
    ) -> Evaluation:
        """Evaluate a single span against quality criteria"""
        if trace:
            eval_span = self.langfuse_service.create_span(
                trace,
                name="evaluate_span",
                input={"span_id": str(span.id), "text_length": len(span.text)}
            )

        try:
            # Generate evaluation prompt
            prompt = self._create_evaluation_prompt(span.text, context)

            # Get LLM evaluation
            response = await self.openai_service.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a QA evaluator for AI chatbots. Evaluate the following response against the given criteria."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.4,
                response_format={"type": "json_object"}
            )

            # Parse evaluation results
            evaluation_data = self._parse_evaluation_response(response)

            # Calculate score
            score, issues = self._calculate_score(evaluation_data)

            # Create evaluation object
            evaluation = Evaluation(
                conversation_id=span.conversation_id,
                span_id=span.id,
                score=score,
                status="good" if score >= 80 else "warn" if score >= 60 else "bad",
                issues=issues
            )

            if eval_span:
                eval_span.end(output={
                    "score": score,
                    "status": evaluation.status,
                    "issues_count": len(issues)
                })

            return evaluation

        except Exception as e:
            if eval_span:
                eval_span.end(output={"error": str(e)})
            logger.error(f"Error evaluating span {span.id}: {e}")
            raise

    def _create_evaluation_prompt(self, text: str, context: Dict = None) -> str:
        """Create evaluation prompt for LLM"""
        criteria_list = "\n".join([
            f"- {key.upper()}: {data['description']} (weight: {data['weight']*100}%)"
            for key, data in self.criteria.items()
        ])

        context_str = f"\nContext: {json.dumps(context)}" if context else ""

        return f"""
Evaluate the following AI assistant response against these quality criteria:

{text}

Criteria:
{criteria_list}

For each criterion, provide:
- Score: 0-100
- Issues: List any specific issues found
- Reasoning: Brief explanation

Format your response as JSON:
{{
  "evaluations": {{
    "intent": {{"score": 85, "issues": ["None"], "reasoning": "Clearly understood user intent"}},
    "fields": {{"score": 90, "issues": [], "reasoning": "All required fields addressed"}},
    // ... etc for all criteria
  }},
  "overall_issues": ["List any critical issues"],
  "recommendations": ["Any improvement suggestions"]
}}

Critical violations to check:
- Confirming level 3 administrative data without verification
- Promising money or compensation
- Providing incorrect legal advice
- Any response that could harm users or violate policies
"""

    def _parse_evaluation_response(self, response: str) -> Dict:
        """Parse LLM evaluation response"""
        try:
            # Try to extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1

            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                return json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse evaluation response: {e}")
            # Return default evaluation
            return {
                "evaluations": {
                    key: {"score": 50, "issues": ["Evaluation parsing failed"], "reasoning": "Error in evaluation"}
                    for key in self.criteria.keys()
                },
                "overall_issues": ["Evaluation parsing failed"],
                "recommendations": []
            }

    def _calculate_score(self, evaluation_data: Dict) -> Tuple[float, List[Dict]]:
        """Calculate overall score and collect issues"""
        issues = []
        weighted_score = 0

        # Process each criterion
        for criterion, data in self.criteria.items():
            if criterion in evaluation_data.get("evaluations", {}):
                eval_result = evaluation_data["evaluations"][criterion]
                score = min(100, max(0, eval_result.get("score", 50)))
                criterion_issues = eval_result.get("issues", [])

                # Add issues to list
                for issue in criterion_issues:
                    if issue and issue != "None":
                        issues.append({
                            "criterion": criterion,
                            "issue": issue,
                            "severity": self._determine_severity(issue)
                        })

                weighted_score += score * data["weight"]

        # Check for critical violations
        overall_issues = evaluation_data.get("overall_issues", [])
        for issue in overall_issues:
            if any(violation in issue.lower() for violation in self.critical_violations):
                issues.append({
                    "criterion": "critical",
                    "issue": issue,
                    "severity": "critical"
                })
                # Cap score at 40 for critical violations
                weighted_score = min(weighted_score, 40)

        return round(weighted_score, 2), issues

    def _determine_severity(self, issue: str) -> str:
        """Determine severity of an issue"""
        critical_keywords = ["critical", "violation", "error", "wrong", "incorrect"]
        major_keywords = ["major", "significant", "important", "issue"]

        if any(keyword in issue.lower() for keyword in critical_keywords):
            return "critical"
        elif any(keyword in issue.lower() for keyword in major_keywords):
            return "major"
        else:
            return "minor"

# Global service instance
evaluator = QualityEvaluator()
