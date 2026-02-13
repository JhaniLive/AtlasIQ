from models.country import Country
from models.preferences import WeightedPreferences


def score_country(country: Country, weights: WeightedPreferences) -> float:
    scores = country.score_fields
    weight_dict = weights.weight_dict

    total = 0.0
    weight_sum = sum(abs(w) for w in weight_dict.values())

    if weight_sum == 0:
        return 0.0

    for key, weight in weight_dict.items():
        total += scores.get(key, 0) * weight

    # Climate bonus: +1 if preference matches
    if weights.climate_preference and country.climate == weights.climate_preference:
        total += weight_sum * 0.5

    return round(total / weight_sum, 2)


def rank_countries(
    countries: list[Country], weights: WeightedPreferences, top_n: int = 5
) -> list[tuple[Country, float]]:
    scored = [(c, score_country(c, weights)) for c in countries]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_n]
