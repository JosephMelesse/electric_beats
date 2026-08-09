import { useState } from "react";

export default function TeamCard({ name, major, intro, photo }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="card card-border border border-base-300 bg-base-100 team-card">
      <div className="card-body items-center text-center">
        <h2 className="card-title italic">{name}</h2>
        <div className="avatar avatar-placeholder">
          <div className="w-20 rounded-full border border-base-300 bg-secondary text-secondary-content">
            {photo && !failed ? (
              <img src={photo} alt={name} onError={() => setFailed(true)} />
            ) : (
              <span className="text-3xl italic">{name[0]}</span>
            )}
          </div>
        </div>
        <p className="font-mono text-sm tracking-wide opacity-70">{major}</p>
        <p className="text-base">{intro}</p>
      </div>
    </article>
  );
}
