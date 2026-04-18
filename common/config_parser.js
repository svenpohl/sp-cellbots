"use strict";

const fs = require("fs");

function strip_inline_comment(line) {
  let in_single_quote = false;
  let in_double_quote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch == "'" && !in_double_quote) {
      in_single_quote = !in_single_quote;
      continue;
    } // if

    if (ch == '"' && !in_single_quote) {
      in_double_quote = !in_double_quote;
      continue;
    } // if

    if (ch == "#" && !in_single_quote && !in_double_quote) {
      const prev = (i > 0) ? line[i - 1] : " ";
      if (/\s/.test(prev)) {
        return line.slice(0, i).trimEnd();
      } // if
    } // if
  } // for

  return line;
} // strip_inline_comment()

function parse_config_string(config_text) {
  const config = {};
  const lines = config_text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw_line = lines[i];
    if (!raw_line) {
      continue;
    } // if

    const trimmed_line = raw_line.trim();
    if (trimmed_line.length == 0 || trimmed_line.startsWith("#")) {
      continue;
    } // if

    const cleaned_line = strip_inline_comment(raw_line).trim();
    if (cleaned_line.length == 0) {
      continue;
    } // if

    const eq_index = cleaned_line.indexOf("=");
    if (eq_index < 0) {
      continue;
    } // if

    const key = cleaned_line.slice(0, eq_index).trim();
    const value = cleaned_line.slice(eq_index + 1).trim();

    if (key.length == 0) {
      continue;
    } // if

    config[key] = value;
  } // for

  return config;
} // parse_config_string()

function parse_config_file(file_path) {
  const config_text = fs.readFileSync(file_path, "utf-8");
  return parse_config_string(config_text);
} // parse_config_file()

module.exports = {
  parse_config_file,
  parse_config_string
};
