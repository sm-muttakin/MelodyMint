import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";

export default function WalletPage() {
  const { currentUser, showToast } = useApp();
  const [wallet, setWallet] = useState(null);
  const [users, setUsers] = useState([]);
  const [buyAmount, setBuyAmount] = useState(50);
  const [giftAmount, setGiftAmount] = useState(10);
  const [giftTo, setGiftTo] = useState("");
  const [loading, setLoading] = useState(false);

  const loadWallet = async () => {
    try {
      const w = await api.getWallet(currentUser.user_id);
      setWallet(w);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const loadUsers = async () => {
    try {
      const list = await api.listUsers();
      setUsers(list.filter((u) => u.user_id !== currentUser.user_id));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    loadWallet();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuy = async () => {
    setLoading(true);
    try {
      await api.createTransaction({ to_user_id: currentUser.user_id, amount: Number(buyAmount), txn_type: "buy" });
      showToast(`Purchased ${buyAmount} tokens`);
      loadWallet();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleGift = async () => {
    if (!giftTo) {
      showToast("Choose who to gift tokens to", true);
      return;
    }
    setLoading(true);
    try {
      await api.createTransaction({ to_user_id: Number(giftTo), amount: Number(giftAmount), txn_type: "gift" });
      showToast(`Gifted ${giftAmount} tokens`);
      loadWallet();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Wallet</h1>
        <p className="page-sub">Buy tokens, gift them, and track your balance.</p>
      </div>

      <div className="card">
        <div className="card-title">Balance</div>
        <div className="wallet-balance">
          <span className="wallet-amount">{wallet ? wallet.token_balance : "—"}</span>
          <span className="wallet-unit">tokens</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Buy Tokens</div>
          <div className="field">
            <label>Amount</label>
            <input type="number" min="1" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} />
          </div>
          <button className="btn btn-gold btn-block" onClick={handleBuy} disabled={loading}>
            Buy {buyAmount} tokens
          </button>
        </div>

        <div className="card">
          <div className="card-title">Gift Tokens</div>
          <div className="field">
            <label>Send to</label>
            <select value={giftTo} onChange={(e) => setGiftTo(e.target.value)}>
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Amount</label>
            <input type="number" min="1" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" onClick={handleGift} disabled={loading}>
            Gift {giftAmount} tokens
          </button>
        </div>
      </div>
    </div>
  );
}
