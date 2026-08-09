export default function NavBar() {
  return (
    <header className="border-b border-base-300 bg-base-100">
      <div className="navbar mx-auto max-w-5xl px-6">
        <div className="navbar-start">
          <a className="text-2xl italic" href="#/">
            Electric Beats
          </a>
        </div>
        <div className="navbar-center">
          <a
            className="btn btn-outline btn-primary btn-lg navbar-play"
            href="#/game"
          >
            Play &#9655;
          </a>
        </div>
        <div className="navbar-end">
          <a className="link link-hover text-xl" href="#/team">
            Team
          </a>
        </div>
      </div>
    </header>
  );
}
