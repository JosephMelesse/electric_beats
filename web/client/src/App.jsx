import { useEffect, useState } from "react";

export function App() {
  const [key, setKey] = useState("");

  useEffect(() => {
    const socket = new WebSocket(`ws://${location.host}/ws`);

    socket.addEventListener("message", (ev) => {
      const message = JSON.parse(ev.data);
      if (message.type === "key") {
        setKey(message.key);
      }
    });

    return () => socket.close();
  }, []);

  return <main id="key">{key}</main>;
}
