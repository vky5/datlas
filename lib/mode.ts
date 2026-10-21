// Reading this computer's folders is only for running datlas on your own machine. It is on only when
// NEXT_PUBLIC_DATLAS_LOCAL=1, which .env.development sets for `npm run dev`. A hosted (production) build
// never has it, so the file routes answer 404 there and the folder picker is hidden: off unless asked for.
export const LOCAL_FILES = process.env.NEXT_PUBLIC_DATLAS_LOCAL === "1";
