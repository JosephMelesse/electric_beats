import TeamCard from "../components/TeamCard.jsx";
import data from "../data.json";

export default function Team() {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {data.team.map((member) => (
        <TeamCard key={member.name} {...member} />
      ))}
    </div>
  );
}
