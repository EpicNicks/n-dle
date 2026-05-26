import { useNavigate } from "react-router-dom";
import "./NotFound.css";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="not-found">
      <p className="not-found__code">404</p>
      <p className="not-found__message">This page doesn't exist.</p>
      <button className="not-found__home" onClick={() => navigate("/")}>
        <span className="not-found__arrow">←</span>
        Back to NDLE!
      </button>
    </div>
  );
}
