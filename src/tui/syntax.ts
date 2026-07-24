import { SyntaxStyle, RGBA, parseColor } from "@opentui/core"

export const syntaxStyle = SyntaxStyle.fromStyles({
  // Basic tokens
  keyword: { fg: RGBA.fromHex("#FF7B72"), bold: true },
  "keyword.import": { fg: RGBA.fromHex("#FF7B72"), bold: true },
  "keyword.operator": { fg: RGBA.fromHex("#FF7B72") },

  string: { fg: RGBA.fromHex("#A5D6FF") },
  comment: { fg: RGBA.fromHex("#8B949E"), italic: true },
  number: { fg: RGBA.fromHex("#79C0FF") },
  boolean: { fg: RGBA.fromHex("#79C0FF") },
  constant: { fg: RGBA.fromHex("#79C0FF") },

  // Functions and types
  function: { fg: RGBA.fromHex("#D2A8FF") },
  "function.call": { fg: RGBA.fromHex("#D2A8FF") },
  "function.method.call": { fg: RGBA.fromHex("#D2A8FF") },
  type: { fg: RGBA.fromHex("#FFA657") },
  constructor: { fg: RGBA.fromHex("#FFA657") },

  // Variables and properties
  variable: { fg: RGBA.fromHex("#E6EDF3") },
  "variable.member": { fg: RGBA.fromHex("#79C0FF") },
  property: { fg: RGBA.fromHex("#79C0FF") },

  // Operators and punctuation
  operator: { fg: RGBA.fromHex("#FF7B72") },
  punctuation: { fg: RGBA.fromHex("#F0F6FC") },
  "punctuation.bracket": { fg: RGBA.fromHex("#F0F6FC") },
  "punctuation.delimiter": { fg: RGBA.fromHex("#C9D1D9") },

  // Default fallback
  default: { fg: RGBA.fromHex("#E6EDF3") },
})

// import { SyntaxStyle } from "@opentui/core";

// // Maps tree-sitter highlight capture names to Tokyo Night colors so the <code>
// // element renders source with the same palette as the rest of the TUI.
// export const syntaxStyle = SyntaxStyle.fromStyles({
//     default: { fg: "#c0caf5" },

//     comment: { fg: "#565f89", italic: true },

//     keyword: { fg: "#bb9af7" },
//     "keyword.function": { fg: "#bb9af7" },
//     "keyword.return": { fg: "#bb9af7" },
//     "keyword.operator": { fg: "#89ddff" },
//     operator: { fg: "#89ddff" },

//     string: { fg: "#9ece6a" },
//     "string.special": { fg: "#9ece6a" },
//     "string.escape": { fg: "#89ddff" },

//     number: { fg: "#ff9e64" },
//     boolean: { fg: "#ff9e64" },
//     constant: { fg: "#ff9e64" },
//     "constant.builtin": { fg: "#ff9e64" },

//     function: { fg: "#7aa2f7" },
//     "function.call": { fg: "#7aa2f7" },
//     "function.method": { fg: "#7aa2f7" },
//     constructor: { fg: "#7aa2f7" },

//     type: { fg: "#2ac3de" },
//     "type.builtin": { fg: "#2ac3de" },

//     variable: { fg: "#c0caf5" },
//     "variable.parameter": { fg: "#e0af68" },
//     "variable.builtin": { fg: "#f7768e" },
//     property: { fg: "#7dcfff" },

//     attribute: { fg: "#bb9af7" },
//     tag: { fg: "#f7768e" },

//     "punctuation.bracket": { fg: "#c0caf5" },
//     "punctuation.delimiter": { fg: "#89ddff" },
//     "punctuation.special": { fg: "#89ddff" },
// });
