import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";
import { pollShareUrl, shareOrigin } from "../sharing";

export function PollQR({ poll, size = 184 }) {
  return (
    <QRCodeSVG
      value={pollShareUrl(poll)}
      size={size}
      level="M"
      marginSize={4}
      fgColor="#0F172A"
      bgColor="#ffffff"
      title={"Scan to open: " + poll.question}
      role="img"
      aria-label={"QR code to join " + poll.question}
    />
  );
}
export default function SharePoll({ poll }) {
  const [message, setMessage] = useState("");
  const input = useRef(null);
  const qr = useRef(null);
  const url = pollShareUrl(poll);
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
    new URL(url).hostname,
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied to your clipboard.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setMessage("Link selected. Copy it from the field above.");
    }
  }
  function download() {
    try {
      const svg = new XMLSerializer().serializeToString(
        qr.current.querySelector("svg"),
      );
      const blobUrl = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "gather-" + (poll.joinCode || poll._id) + ".svg";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setMessage("QR code downloaded.");
    } catch {
      setMessage("The download could not start. You can still share the link.");
    }
  }
  return (
    <section className="share-panel" aria-label="Share this poll">
      <div className="share-heading">
        <div>
          <span className="eyebrow">Better with everyone</span>
          <h2>Invite your people.</h2>
        </div>
        <Link
          className="button secondary small"
          to={"/polls/" + poll._id + "/present"}
        >
          Present ↗
        </Link>
      </div>
      <div className="share-grid">
        <div className="qr-block" ref={qr}>
          <PollQR poll={poll} />
          <button type="button" className="text-button" onClick={download}>
            Download QR
          </button>
        </div>
        <div className="share-details">
          {poll.joinCode && (
            <>
              <span className="field-label">Join code</span>
              <strong
                className="join-code-display"
                aria-label={"Join code " + poll.joinCode.split("").join(" ")}
              >
                {poll.joinCode}
              </strong>
              <p className="field-hint">
                Enter it at {new URL(shareOrigin()).host}/join
              </p>
            </>
          )}
          <label className="field-label" htmlFor="share-url">
            Or share the link
          </label>
          <input
            ref={input}
            id="share-url"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
          <button className="button secondary small" onClick={copy}>
            Copy link
          </button>
        </div>
      </div>
      <p className="field-hint">
        Scan with your phone's camera. Sign in to cast one vote.
      </p>
      {loopback && (
        <p className="field-hint">
          This link opens on this computer only. For phone testing, open Gather
          using this computer's network address.
        </p>
      )}
      <p className="share-feedback" role="status">
        {message}
      </p>
    </section>
  );
}
