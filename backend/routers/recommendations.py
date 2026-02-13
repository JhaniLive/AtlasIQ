import asyncio
import logging

from fastapi import APIRouter, HTTPException

from agents.planner_agent import PlannerAgent

logger = logging.getLogger(__name__)
from agents.scoring_agent import ScoringAgent
from agents.insight_agent import InsightAgent
from agents.explanation_agent import ExplanationAgent
from models.preferences import UserPreferences
from models.recommendation import CountryScore, RecommendationResponse
from services import country_service
from services.cache_service import cache

router = APIRouter(tags=["recommendations"])

planner = PlannerAgent()
scorer = ScoringAgent()
insight_agent = InsightAgent()
explanation_agent = ExplanationAgent()


@router.post("/recommendations", response_model=RecommendationResponse)
async def get_recommendations(prefs: UserPreferences):
    interests = prefs.interests.strip()
    if not interests:
        raise HTTPException(status_code=400, detail="Interests cannot be empty")

    # Check cache
    cached = cache.get(interests)
    if cached:
        return cached

    try:
        # Step 1: Parse interests into weights
        planner_result = await planner.run({"interests": interests})
        preferences = planner_result["preferences"]

        # Step 2: Score and rank countries
        countries = country_service.get_all()
        scoring_result = await scorer.run({
            "countries": countries,
            "preferences": preferences,
            "top_n": 5,
        })
        rankings = scoring_result["rankings"]

        # Step 3: Generate insights and explanation in parallel
        insight_tasks = [
            insight_agent.run({
                "country_name": r["country"].name,
                "interests": interests,
                "score": r["score"],
            })
            for r in rankings
        ]
        explanation_task = explanation_agent.run({
            "rankings": [
                {"name": r["country"].name, "score": r["score"]}
                for r in rankings
            ],
            "interests": interests,
        })

        results = await asyncio.gather(*insight_tasks, explanation_task)
        insights = results[:-1]
        explanation_result = results[-1]

        # Build response
        country_scores = [
            CountryScore(
                code=r["country"].code,
                name=r["country"].name,
                score=r["score"],
                insight=insights[i]["insight"],
            )
            for i, r in enumerate(rankings)
        ]

        response = RecommendationResponse(
            rankings=country_scores,
            explanation=explanation_result["explanation"],
            interests_parsed=str(preferences.weight_dict),
        )

        cache.set(interests, response)
        return response

    except Exception as e:
        logger.exception("Recommendation failed")
        raise HTTPException(status_code=500, detail=str(e))
