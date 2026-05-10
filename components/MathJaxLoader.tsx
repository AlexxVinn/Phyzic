"use client";

import { useEffect } from "react";

const MATHJAX_SRC = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.min.js";
const SCRIPT_ID = "mathjax-script";

export default function MathJaxLoader() {
  useEffect(() => {
    // Prevent duplicate injection
    if (document.getElementById(SCRIPT_ID)) return;

    // Set MathJax config BEFORE loading the script.
    // Include $ / $$ so MathJax can catch any raw math our regex might miss.
    (window as any).MathJax = {
      tex: {
        inlineMath: [
          ["\\(", "\\)"],
          ["$", "$"],
        ],
        displayMath: [
          ["\\[", "\\]"],
          ["$$", "$$"],
        ],
        processEscapes: true,
        processEnvironments: true,
        processRefs: true,
      },
      svg: {
        fontCache: "global",
        mtextInheritFont: true,
        merrorInheritFont: true,
      },
      // Let default startup run; no custom ready() needed.
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = MATHJAX_SRC;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return null;
}
