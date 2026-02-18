import { useState, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './TripSummaryPanel.css';

function SectionHeader({ title, count }) {
  return (
    <div className="tsp-section-header">
      <span className="tsp-section-title">{title}</span>
      <span className="tsp-section-count">{count}</span>
    </div>
  );
}

function SummaryItem({ item, onToggle, onRemove }) {
  return (
    <div className={`tsp-item ${item.included ? '' : 'tsp-item--excluded'}`}>
      <label className="tsp-item__check" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={item.included}
          onChange={() => onToggle(item.id)}
        />
        <span className="tsp-item__checkmark" />
      </label>
      <div className="tsp-item__content">
        {item.type === 'country' && (
          <span className="tsp-item__text">
            {item.data.placeName && item.data.placeName.toLowerCase() !== item.data.name.toLowerCase()
              ? `${item.data.placeName}, ${item.data.name}`
              : item.data.name}
          </span>
        )}
        {item.type === 'search' && (
          <span className="tsp-item__text tsp-item__text--search">
            &ldquo;{item.data.term}&rdquo;
          </span>
        )}
        {item.type === 'chat' && (
          <div className="tsp-item__chat">
            <span className="tsp-item__chat-country">{item.data.countryName}</span>
            <span className="tsp-item__chat-q">Q: {item.data.question}</span>
            {item.data.answer && (
              <span className="tsp-item__chat-a">
                A: {item.data.answer.length > 150
                  ? item.data.answer.slice(0, 150) + '...'
                  : item.data.answer}
              </span>
            )}
          </div>
        )}
        {item.type === 'places' && (
          <div className="tsp-item__places">
            <span className="tsp-item__places-label">{item.data.countryName}</span>
            <div className="tsp-item__places-list">
              {item.data.places.slice(0, 5).map((p, i) => (
                <span key={p.name + i} className="tsp-item__place-chip">
                  {p.name} {p.rating > 0 ? `\u2605${p.rating.toFixed(1)}` : ''}
                </span>
              ))}
              {item.data.places.length > 5 && (
                <span className="tsp-item__place-chip tsp-item__place-chip--more">
                  +{item.data.places.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}
        {item.type === 'bookmark' && (
          <span className="tsp-item__text">
            {'\u2605'} {item.data.name}
          </span>
        )}
      </div>
      <button className="tsp-item__remove" onClick={() => onRemove(item.id)} title="Remove">
        &times;
      </button>
    </div>
  );
}

export default function TripSummaryPanel({
  items,
  userName,
  onSetUserName,
  aiConclusion,
  conclusionLoading,
  onToggleItem,
  onRemoveItem,
  onGenerateConclusion,
  onClose,
  getIncludedItems,
}) {
  const [nameEditing, setNameEditing] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  const grouped = useMemo(() => {
    const g = { country: [], search: [], chat: [], places: [], bookmark: [] };
    for (const item of items) {
      if (g[item.type]) g[item.type].push(item);
    }
    return g;
  }, [items]);

  const handleNameSave = useCallback(() => {
    onSetUserName(nameInput.trim());
    setNameEditing(false);
  }, [nameInput, onSetUserName]);

  const handleDownloadPDF = useCallback(() => {
    const included = getIncludedItems();
    if (included.length === 0) return;

    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pw - margin * 2;
    let y = 0;

    // ── Color palette ──
    const C = {
      brand:    [0, 180, 100],
      accent:   [0, 170, 220],
      dark:     [30, 30, 45],
      text:     [50, 50, 60],
      muted:    [130, 130, 140],
      light:    [240, 240, 245],
      white:    [255, 255, 255],
      star:     [255, 185, 0],
      open:     [0, 180, 100],
      closed:   [220, 70, 70],
      cardBg:   [248, 248, 252],
      cardBdr:  [225, 225, 235],
    };

    const ensureSpace = (need) => {
      if (y + need > ph - 20) { doc.addPage(); y = 20; }
    };

    // ── Stars helper ──
    const drawStars = (x, yPos, rating) => {
      const full = Math.floor(rating);
      const half = rating - full >= 0.3;
      doc.setFontSize(9);
      for (let i = 0; i < 5; i++) {
        if (i < full) {
          doc.setTextColor(...C.star);
          doc.text('\u2605', x + i * 6, yPos);
        } else if (i === full && half) {
          doc.setTextColor(...C.star);
          doc.text('\u2605', x + i * 6, yPos);
        } else {
          doc.setTextColor(200, 200, 210);
          doc.text('\u2606', x + i * 6, yPos);
        }
      }
    };

    // ── Page footer ──
    const addFooter = (pageNum, totalPages) => {
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text('AtlasIQ — AI-Powered World Explorer', margin, ph - 10);
      doc.text(`Page ${pageNum} of ${totalPages}`, pw - margin, ph - 10, { align: 'right' });
    };

    // ═════════════════════════════════════════════════════════
    //  COVER / HEADER
    // ═════════════════════════════════════════════════════════

    // Dark header band
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, pw, 52, 'F');

    // Brand accent bar
    doc.setFillColor(...C.brand);
    doc.rect(0, 52, pw, 2.5, 'F');

    // Title
    doc.setFontSize(28);
    doc.setTextColor(...C.white);
    doc.text('AtlasIQ', margin, 25);

    doc.setFontSize(13);
    doc.setTextColor(180, 220, 200);
    doc.text('Trip Summary', margin, 35);

    // Right side — user name + date
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 195);
    if (userName) {
      doc.text(`Prepared for: ${userName}`, pw - margin, 25, { align: 'right' });
    }
    doc.text(dateStr, pw - margin, 35, { align: 'right' });

    y = 64;

    // ── Quick stats bar ──
    const countries = included.filter(i => i.type === 'country');
    const searches = included.filter(i => i.type === 'search');
    const chats = included.filter(i => i.type === 'chat');
    const placesItems = included.filter(i => i.type === 'places');
    const allPlaces = placesItems.flatMap(i => i.data.places);
    const bms = included.filter(i => i.type === 'bookmark');

    const stats = [
      { label: 'Countries', value: countries.length },
      { label: 'Searches', value: searches.length },
      { label: 'Chats', value: chats.length },
      { label: 'Places', value: allPlaces.length },
      { label: 'Bookmarks', value: bms.length },
    ].filter(s => s.value > 0);

    if (stats.length > 0) {
      const statW = contentW / stats.length;
      doc.setFillColor(...C.light);
      doc.roundedRect(margin, y, contentW, 18, 3, 3, 'F');
      stats.forEach((s, i) => {
        const cx = margin + statW * i + statW / 2;
        doc.setFontSize(14);
        doc.setTextColor(...C.brand);
        doc.text(String(s.value), cx, y + 8, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text(s.label, cx, y + 14, { align: 'center' });
      });
      y += 26;
    }

    // ═════════════════════════════════════════════════════════
    //  SECTION HELPER
    // ═════════════════════════════════════════════════════════

    const sectionTitle = (title, count) => {
      ensureSpace(16);
      // Accent left bar
      doc.setFillColor(...C.brand);
      doc.rect(margin, y, 3, 10, 'F');
      doc.setFontSize(13);
      doc.setTextColor(...C.dark);
      doc.text(title, margin + 7, y + 7);
      if (count) {
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text(`(${count})`, margin + 7 + doc.getTextWidth(title) + 4, y + 7);
      }
      y += 14;
    };

    const addWrappedText = (text, x, maxW, fontSize = 9, color = C.text) => {
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        ensureSpace(5);
        doc.text(line, x, y);
        y += fontSize * 0.45 + 1;
      }
    };

    // ═════════════════════════════════════════════════════════
    //  COUNTRIES
    // ═════════════════════════════════════════════════════════

    if (countries.length > 0) {
      sectionTitle('Countries Explored', countries.length);
      const cols = Math.min(countries.length, 3);
      const colW = (contentW - (cols - 1) * 4) / cols;

      for (let i = 0; i < countries.length; i += cols) {
        ensureSpace(22);
        for (let j = 0; j < cols && i + j < countries.length; j++) {
          const c = countries[i + j];
          const x = margin + j * (colW + 4);
          const name = c.data.placeName && c.data.placeName.toLowerCase() !== c.data.name.toLowerCase()
            ? `${c.data.placeName}, ${c.data.name}`
            : c.data.name;
          // Card background
          doc.setFillColor(...C.cardBg);
          doc.setDrawColor(...C.cardBdr);
          doc.roundedRect(x, y, colW, 16, 2, 2, 'FD');
          // Flag placeholder circle
          doc.setFillColor(...C.accent);
          doc.circle(x + 8, y + 8, 4, 'F');
          doc.setFontSize(6);
          doc.setTextColor(...C.white);
          doc.text(c.data.code || '?', x + 8, y + 9.5, { align: 'center' });
          // Name
          doc.setFontSize(9);
          doc.setTextColor(...C.dark);
          doc.text(name, x + 16, y + 10, { maxWidth: colW - 20 });
        }
        y += 20;
      }
      y += 4;
    }

    // ═════════════════════════════════════════════════════════
    //  SEARCHES
    // ═════════════════════════════════════════════════════════

    if (searches.length > 0) {
      sectionTitle('Your Searches', searches.length);
      for (const s of searches) {
        ensureSpace(8);
        doc.setFillColor(...C.light);
        doc.roundedRect(margin + 2, y - 3, contentW - 4, 8, 1.5, 1.5, 'F');
        doc.setFontSize(9);
        doc.setTextColor(...C.text);
        doc.text(`"${s.data.term}"`, margin + 8, y + 2);
        y += 10;
      }
      y += 4;
    }

    // ═════════════════════════════════════════════════════════
    //  CHAT HIGHLIGHTS
    // ═════════════════════════════════════════════════════════

    if (chats.length > 0) {
      sectionTitle('Chat Highlights', chats.length);
      for (const c of chats) {
        const answerShort = c.data.answer
          ? (c.data.answer.length > 400 ? c.data.answer.slice(0, 400) + '...' : c.data.answer)
            .replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, '')
          : '';
        const answerLines = answerShort ? doc.splitTextToSize(answerShort, contentW - 16) : [];
        const cardH = 18 + answerLines.length * 4;

        ensureSpace(cardH + 4);
        // Card
        doc.setFillColor(...C.cardBg);
        doc.setDrawColor(...C.cardBdr);
        doc.roundedRect(margin, y, contentW, cardH, 2, 2, 'FD');

        // Country label
        doc.setFontSize(7);
        doc.setTextColor(...C.accent);
        doc.text(c.data.countryName, margin + 6, y + 6);

        // Question
        doc.setFontSize(9);
        doc.setTextColor(...C.dark);
        doc.text(`Q: ${c.data.question}`, margin + 6, y + 12, { maxWidth: contentW - 12 });

        // Answer
        if (answerLines.length > 0) {
          doc.setFontSize(8);
          doc.setTextColor(...C.muted);
          let ay = y + 18;
          for (const line of answerLines) {
            doc.text(line, margin + 6, ay);
            ay += 4;
          }
        }
        y += cardH + 4;
      }
      y += 4;
    }

    // ═════════════════════════════════════════════════════════
    //  PLACES DISCOVERED — the star section
    // ═════════════════════════════════════════════════════════

    if (placesItems.length > 0) {
      sectionTitle('Places Discovered', allPlaces.length);

      for (const pi of placesItems) {
        // Region sub-header
        ensureSpace(10);
        doc.setFontSize(10);
        doc.setTextColor(...C.accent);
        doc.text(pi.data.countryName, margin + 4, y + 3);
        y += 8;

        // Place cards — 2 per row
        const places = pi.data.places.slice(0, 20);
        const cardW = (contentW - 6) / 2;
        const cardH = 36;

        for (let i = 0; i < places.length; i += 2) {
          ensureSpace(cardH + 4);

          for (let j = 0; j < 2 && i + j < places.length; j++) {
            const p = places[i + j];
            const x = margin + j * (cardW + 6);
            const cy = y;

            // Card bg + border
            doc.setFillColor(...C.cardBg);
            doc.setDrawColor(...C.cardBdr);
            doc.roundedRect(x, cy, cardW, cardH, 2.5, 2.5, 'FD');

            // Number badge
            doc.setFillColor(...C.brand);
            doc.roundedRect(x + 3, cy + 3, 10, 10, 2, 2, 'F');
            doc.setFontSize(7);
            doc.setTextColor(...C.white);
            doc.text(String(i + j + 1), x + 8, cy + 9.5, { align: 'center' });

            // Place name
            doc.setFontSize(9);
            doc.setTextColor(...C.dark);
            const nameMaxW = cardW - 20;
            const pName = p.name.length > 30 ? p.name.slice(0, 28) + '...' : p.name;
            doc.text(pName, x + 16, cy + 9, { maxWidth: nameMaxW });

            // Rating stars + number
            let rx = x + 4;
            const ry = cy + 17;
            if (p.rating > 0) {
              drawStars(rx, ry, p.rating);
              doc.setFontSize(8);
              doc.setTextColor(...C.star);
              doc.text(p.rating.toFixed(1), rx + 32, ry);
              rx += 46;
            }

            // Review count
            if (p.review_count > 0) {
              doc.setFontSize(7);
              doc.setTextColor(...C.muted);
              doc.text(`(${p.review_count.toLocaleString()} reviews)`, rx, ry);
            }

            // Row 3: status + price + coordinates
            let infoX = x + 4;
            const infoY = cy + 23;

            // Open / Closed badge
            if (p.is_open === true) {
              doc.setFillColor(...C.open);
              doc.roundedRect(infoX, infoY - 3, 14, 5, 1, 1, 'F');
              doc.setFontSize(5.5);
              doc.setTextColor(...C.white);
              doc.text('OPEN', infoX + 7, infoY, { align: 'center' });
              infoX += 16;
            } else if (p.is_open === false) {
              doc.setFillColor(...C.closed);
              doc.roundedRect(infoX, infoY - 3, 18, 5, 1, 1, 'F');
              doc.setFontSize(5.5);
              doc.setTextColor(...C.white);
              doc.text('CLOSED', infoX + 9, infoY, { align: 'center' });
              infoX += 20;
            }

            // Price level
            if (p.price_level > 0) {
              doc.setFontSize(7);
              doc.setTextColor(...C.brand);
              doc.text('$'.repeat(p.price_level), infoX, infoY);
              infoX += p.price_level * 4 + 4;
            }

            // Coordinates
            if (p.lat && p.lng) {
              doc.setFontSize(6);
              doc.setTextColor(...C.muted);
              doc.text(`${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`, infoX, infoY);
            }

            // Address (bottom of card)
            if (p.address) {
              doc.setFontSize(6.5);
              doc.setTextColor(...C.muted);
              const addr = p.address.length > 50 ? p.address.slice(0, 48) + '...' : p.address;
              doc.text(addr, x + 4, cy + 30, { maxWidth: cardW - 8 });
            }

            // Types / tags
            if (p.types?.length > 0) {
              const tags = p.types.slice(0, 3).join(' / ');
              doc.setFontSize(5.5);
              doc.setTextColor(160, 160, 175);
              doc.text(tags, x + 4, cy + 34, { maxWidth: cardW - 8 });
            }
          }
          y += cardH + 4;
        }
        y += 4;
      }
    }

    // ═════════════════════════════════════════════════════════
    //  BOOKMARKS
    // ═════════════════════════════════════════════════════════

    if (bms.length > 0) {
      sectionTitle('Bookmarked', bms.length);
      for (const b of bms) {
        ensureSpace(10);
        doc.setFontSize(9);
        doc.setTextColor(...C.star);
        doc.text('\u2605', margin + 4, y + 3);
        doc.setTextColor(...C.dark);
        doc.text(b.data.name, margin + 12, y + 3);
        y += 8;
      }
      y += 4;
    }

    // ═════════════════════════════════════════════════════════
    //  AI CONCLUSION
    // ═════════════════════════════════════════════════════════

    if (aiConclusion && !aiConclusion.startsWith('Failed')) {
      sectionTitle('AI Travel Conclusion', '');
      const clean = aiConclusion.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/gm, '');
      // Conclusion in a tinted box
      const conclusionLines = doc.splitTextToSize(clean, contentW - 16);
      const boxH = conclusionLines.length * 4.5 + 12;
      ensureSpace(boxH + 4);
      doc.setFillColor(240, 255, 248);
      doc.setDrawColor(180, 230, 210);
      doc.roundedRect(margin, y, contentW, boxH, 3, 3, 'FD');
      doc.setFontSize(9);
      doc.setTextColor(...C.text);
      let cly = y + 8;
      for (const line of conclusionLines) {
        doc.text(line, margin + 8, cly);
        cly += 4.5;
      }
      y += boxH + 6;
    }

    // ═════════════════════════════════════════════════════════
    //  FOOTER ON ALL PAGES
    // ═════════════════════════════════════════════════════════

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      // Bottom accent line
      doc.setDrawColor(...C.brand);
      doc.setLineWidth(0.5);
      doc.line(margin, ph - 14, pw - margin, ph - 14);
      addFooter(p, totalPages);
    }

    const fileDateStr = new Date().toISOString().slice(0, 10);
    doc.save(`atlasiq-trip-summary-${fileDateStr}.pdf`);
  }, [getIncludedItems, userName, aiConclusion]);

  const includedCount = useMemo(() => items.filter(i => i.included).length, [items]);

  return (
    <div className="tsp-overlay">
      <div className="tsp-header">
        <button className="tsp-header__back" onClick={onClose} title="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h2 className="tsp-header__title">Trip Summary</h2>
        <span className="tsp-header__count">{includedCount} items</span>
        <button
          className="tsp-header__download"
          onClick={handleDownloadPDF}
          disabled={includedCount === 0}
          title="Download PDF"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2V12M9 12L5 8M9 12L13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 14V15C2 15.5523 2.44772 16 3 16H15C15.5523 16 16 15.5523 16 15V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>PDF</span>
        </button>
      </div>

      <div className="tsp-body">
        {/* User greeting */}
        <div className="tsp-greeting">
          {nameEditing ? (
            <div className="tsp-greeting__edit">
              <span>Hello, </span>
              <input
                className="tsp-greeting__input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                autoFocus
                placeholder="Your name"
              />
              <span>!</span>
            </div>
          ) : (
            <div className="tsp-greeting__display" onClick={() => { setNameInput(userName); setNameEditing(true); }}>
              <span className="tsp-greeting__text">
                Hello{userName ? `, ${userName}` : ''}!
              </span>
              <span className="tsp-greeting__edit-icon" title="Edit name">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 1.5L12.5 3.5L4 12H2V10L10.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </div>
          )}
          <span className="tsp-greeting__date">
            Your exploration on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="tsp-empty">
            <p>No exploration data yet. Start searching and chatting to build your trip summary!</p>
          </div>
        )}

        {/* Countries */}
        {grouped.country.length > 0 && (
          <div className="tsp-section">
            <SectionHeader title="Countries Explored" count={grouped.country.length} />
            {grouped.country.map(item => (
              <SummaryItem key={item.id} item={item} onToggle={onToggleItem} onRemove={onRemoveItem} />
            ))}
          </div>
        )}

        {/* Searches */}
        {grouped.search.length > 0 && (
          <div className="tsp-section">
            <SectionHeader title="Searches" count={grouped.search.length} />
            {grouped.search.map(item => (
              <SummaryItem key={item.id} item={item} onToggle={onToggleItem} onRemove={onRemoveItem} />
            ))}
          </div>
        )}

        {/* Chat highlights */}
        {grouped.chat.length > 0 && (
          <div className="tsp-section">
            <SectionHeader title="Chat Highlights" count={grouped.chat.length} />
            {grouped.chat.map(item => (
              <SummaryItem key={item.id} item={item} onToggle={onToggleItem} onRemove={onRemoveItem} />
            ))}
          </div>
        )}

        {/* Places */}
        {grouped.places.length > 0 && (
          <div className="tsp-section">
            <SectionHeader title="Places Discovered" count={grouped.places.length} />
            {grouped.places.map(item => (
              <SummaryItem key={item.id} item={item} onToggle={onToggleItem} onRemove={onRemoveItem} />
            ))}
          </div>
        )}

        {/* Bookmarks */}
        {grouped.bookmark.length > 0 && (
          <div className="tsp-section">
            <SectionHeader title="Bookmarked" count={grouped.bookmark.length} />
            {grouped.bookmark.map(item => (
              <SummaryItem key={item.id} item={item} onToggle={onToggleItem} onRemove={onRemoveItem} />
            ))}
          </div>
        )}

        {/* AI Conclusion */}
        {items.length > 0 && (
          <div className="tsp-section tsp-section--conclusion">
            <SectionHeader title="AI Conclusion" count="" />
            {aiConclusion ? (
              <div className="tsp-conclusion__text">{aiConclusion}</div>
            ) : (
              <button
                className="tsp-conclusion__btn"
                onClick={onGenerateConclusion}
                disabled={conclusionLoading || includedCount === 0}
              >
                {conclusionLoading ? (
                  <>
                    <span className="tsp-conclusion__spinner" />
                    Generating...
                  </>
                ) : (
                  'Generate AI Conclusion'
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
