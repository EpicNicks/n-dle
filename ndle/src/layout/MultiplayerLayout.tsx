import { Outlet } from "react-router-dom";
import { MultiplayerProvider } from "../context/MultiplayerContext";

export function MultiplayerLayout() {
  return (
    <MultiplayerProvider>
      <Outlet />
    </MultiplayerProvider>
  );
}
