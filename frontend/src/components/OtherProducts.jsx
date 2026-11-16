import { useState } from "react";
import { requestRelatedProducts, safeLeadHubOrigin } from "../utils/relatedProducts.js";

const leadHubUrl = safeLeadHubOrigin(document.querySelector('meta[name="leadhub-base-url"]')?.content);

export function OtherProducts() {
  const [checked, setChecked] = useState(false);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");

  if (!leadHubUrl) return null;

  const handleChange = async (event) => {
    const checkbox = event.currentTarget;
    const enabled = checkbox.checked;
    setChecked(enabled);
    setItems([]);
    setStatus(enabled ? "Loading suggestions…" : "");
    if (!enabled) return;
    try {
      const related = await requestRelatedProducts(leadHubUrl, "draftloom", true);
      if (checkbox.checked) {
        setItems(related);
        setStatus(related.length ? "" : "No related products are available right now.");
      }
    } catch {
      if (checkbox.checked) setStatus("Suggestions are unavailable right now.");
    }
  };

  return (
    <div className="other-products">
      <label><input type="checkbox" checked={checked} onChange={handleChange} /> Show me relevant products too. No draft or usage data is shared.</label>
      <p role="status" aria-live="polite">{status}</p>
      {items.length > 0 && <><h2>Our other products</h2><ul>{items.map((item) => <li key={item.id}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a><span> — {item.reason}</span></li>)}</ul></>}
    </div>
  );
}
