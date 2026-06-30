import { useState } from "react";
import { StoriesSequence } from "../../../types";

export function StoriesBlock({ seq }: { seq: StoriesSequence }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen((o) => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Stories · Dia {seq.dia}</span>
          <strong className="cardTitle">{seq.sequencia}</strong>
        </div>
        <span className="cardChevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="cardBody">
          {seq.stories.map((story) => (
            <div key={story.ordem} className="storyItem">
              <span className="storyTag">
                {story.ordem}. {story.tipo === "vídeo" ? "🎬 Vídeo" : "📝 Post"}
              </span>
              <p>{story.texto}</p>
            </div>
          ))}
          <div className="cardActions">
            <small style={{ color: "#64748b" }}>Stories: apenas texto.</small>
          </div>
        </div>
      )}
    </article>
  );
}
