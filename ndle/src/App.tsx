import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { WelcomePage } from "./pages/welcome-page/Welcome";
import { GamePage } from "./pages/game-page/Game";
import { NotFoundPage } from "./pages/not-found-page/NotFound";
import { MultiplayerLayout } from "./layout/MultiplayerLayout";
import { MultiplayerLobby } from "./pages/multiplayer/MultiplayerLobby";
import { RoomView } from "./pages/multiplayer/RoomView";
import "./App.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <WelcomePage /> },
      { path: "game/:wordHash", element: <GamePage /> },
      {
        element: <MultiplayerLayout />,
        children: [
          { path: "multiplayer", element: <MultiplayerLobby /> },
          { path: "room/:code", element: <RoomView /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
