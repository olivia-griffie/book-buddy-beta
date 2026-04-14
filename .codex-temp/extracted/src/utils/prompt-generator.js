function nextPrompt(prompts = [], index = 0) {
  if (!prompts.length) {
    return null;
  }

  return prompts[index % prompts.length];
}

module.exports = {
  nextPrompt,
};
