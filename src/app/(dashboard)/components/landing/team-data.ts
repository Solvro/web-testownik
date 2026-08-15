export type ProjectTeam =
  | "Product"
  | "UX/UI"
  | "Frontend"
  | "Backend"
  | "AI/ML"
  | "Promo";

export interface TeamMember {
  name: string;
  team: ProjectTeam;
  role: string;
  active: boolean;
  github?: string;
  imageUrl?: string;
  profileUrl?: string;
}

export const TEAM_MEMBERS = [
  {
    name: "Antoni Czaplicki",
    team: "Product",
    role: "Product Owner",
    active: true,
    github: "Antoni-Czaplicki",
  },
  {
    name: "Michał Golisz",
    team: "Product",
    role: "Project Manager",
    active: true,
    github: "MichalGolisz",
  },
  {
    name: "Oliwier Kądziołka",
    team: "Frontend",
    role: "Tech Lead",
    active: true,
    github: "olios123",
  },
  {
    name: "Bartłomiej Rutkowski",
    team: "Backend",
    role: "Tech Lead",
    active: true,
    github: "Batirro",
  },
  {
    name: "Jan Druszcz",
    team: "Backend",
    role: "Developer",
    active: true,
    github: "JanekDr",
  },
  {
    name: "Wiktor Gruszczyński",
    team: "Backend",
    role: "Developer",
    active: true,
    github: "WiktorGruszczynski",
  },
  {
    name: "Dominik Dąbrowski",
    team: "Backend",
    role: "Developer",
    active: true,
    github: "DominikDab341",
  },
  {
    name: "Mateusz Reszel",
    team: "Backend",
    role: "Developer",
    active: true,
    github: "matixi9",
  },
  {
    name: "Tymon Jędryczka",
    team: "Frontend",
    role: "Developer",
    active: true,
    github: "jedryczkatymon",
  },
  {
    name: "Bartosz Fabianowski",
    team: "Frontend",
    role: "Developer",
    active: true,
    github: "GumisC4",
  },
  {
    name: "Jakub Kuflik",
    team: "Frontend",
    role: "Developer",
    active: true,
    github: "Qufel",
  },
  {
    name: "Aleksandra Cielanga",
    team: "Frontend",
    role: "Developer",
    active: true,
    github: "azvrc",
  },
  {
    name: "Kacper Petelicki",
    team: "Frontend",
    role: "Developer",
    active: true,
    github: "Kacperrrr2",
  },
  {
    name: "Maja Maciejewska",
    team: "UX/UI",
    role: "Designer",
    active: true,
    github: "maja18108",
  },
  {
    name: "Maksym Tarasiuk",
    team: "UX/UI",
    role: "Designer",
    active: true,
    github: "maks1u",
  },
  {
    name: "Kamil Borkowski",
    team: "AI/ML",
    role: "Developer",
    active: true,
    github: "BKmil",
  },
  {
    name: "Patryk Mikołajewicz",
    team: "AI/ML",
    role: "Developer",
    active: true,
  },
  {
    name: "Marvin Ruciński",
    team: "Product",
    role: "Product Manager",
    active: false,
    github: "MarvinRucinski",
  },
  {
    name: "Krystian Woźniak",
    team: "Promo",
    role: "Marketing",
    active: true,
    imageUrl:
      "https://cms.solvro.pl/assets/dac7772c-a766-470e-a058-de8a9b0d5eb0?key=member",
    profileUrl: "https://www.linkedin.com/in/wozniak-krystian/",
  },
  {
    name: "Sara Garg",
    team: "Backend",
    role: "Tech Lead",
    active: false,
    github: "MoonPrincess06",
  },
] as const satisfies readonly TeamMember[];

export const TEAM_SIZE = TEAM_MEMBERS.length;
