import { useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";

export default function TagChip({ songTag, tagName, tagCategory, onVoted }) {
  const { activeUserId, showToast } = useApp();
  const [voting, setVoting] = useState(false);

  const total = songTag.upvotes + songTag.downvotes;
  const upPct = total > 0 ? (songTag.upvotes / total) * 100 : 50;

  const vote = async (value) => {
    if (!activeUserId) return;
    setVoting(true);
    try {
      const updated = await api.voteSongTag({
        song_tag_id: songTag.song_tag_id,
        value,
      });
      onVoted?.(updated);
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setVoting(false);
    }
  };

  return (
    <span className={`tag-chip ${songTag.status === "removed" ? "removed" : ""}`}>
      <span>
        <span className="tag-chip-name">{tagName}</span>{" "}
        <span className="tag-chip-category">{tagCategory}</span>
      </span>
      <span className="vote-split" title={`${songTag.upvotes} up / ${songTag.downvotes} down`}>
        <span className="vote-split-up" style={{ width: `${upPct}%` }} />
        <span className="vote-split-down" style={{ width: `${100 - upPct}%` }} />
      </span>
      <span className="vote-btns">
        <button className="vote-btn" disabled={voting} onClick={() => vote(1)} title="Upvote">
          ▲
        </button>
        <button className="vote-btn" disabled={voting} onClick={() => vote(-1)} title="Downvote">
          ▼
        </button>
      </span>
    </span>
  );
}
