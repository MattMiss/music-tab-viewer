import { createContext } from "react";
import type { LibraryContextValue } from "../types/library";

const LibraryContext = createContext<LibraryContextValue | null>(null);
export default LibraryContext;
