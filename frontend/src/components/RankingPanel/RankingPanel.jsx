import './RankingPanel.css';

export default function RankingPanel({ recommendations, onCountrySelect }) {
  if (!recommendations) return null;

  return (
    <div className="ranking-panel">
      <h2 className="ranking-panel__title">Top Picks</h2>
      <ul className="ranking-panel__list">
        {recommendations.rankings.map((r, i) => (
          <li
            key={r.code}
            className="ranking-panel__item"
            onClick={() => onCountrySelect(r.code)}
          >
            <span className="ranking-panel__rank">#{i + 1}</span>
            <div className="ranking-panel__info">
              <span className="ranking-panel__name">{r.name}</span>
              <span className="ranking-panel__score">{r.score}</span>
            </div>
          </li>
        ))}
      </ul>
      {recommendations.explanation && (
        <div className="ranking-panel__explanation">
          <p>{recommendations.explanation}</p>
        </div>
      )}
    </div>
  );
}
