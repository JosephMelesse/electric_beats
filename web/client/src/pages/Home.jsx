import { useState } from "react";

import data from "../data.json";

function InstrumentPhoto() {
  const [failed, setFailed] = useState(false);
  if (!data.instrument.photo || failed) {
    return (
      <span className="font-mono text-sm tracking-widest opacity-60">
        PHOTO
      </span>
    );
  }
  return (
    <img
      src={data.instrument.photo}
      alt={data.instrument.name}
      onError={() => setFailed(true)}
    />
  );
}

export default function Home() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="home">
      <p className="mb-2 font-mono text-sm tracking-widest opacity-60">
        {data.instrument.tagline}
      </p>
      <h1>
        <span className="mark">{data.instrument.name}</span>
      </h1>
      {expanded ? (
        <div className="home-detail">
          <button
            type="button"
            className="home-photo home-photo-small"
            onClick={() => setExpanded(false)}
          >
            <InstrumentPhoto />
          </button>
          {data.sections.map((section) => (
            <section key={section.title} className="home-section">
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="home-photo home-photo-large"
          onClick={() => setExpanded(true)}
        >
          <InstrumentPhoto />
        </button>
      )}
    </div>
  );
}
