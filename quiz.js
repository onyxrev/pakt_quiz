var PaktQuiz = function(quizData, quizResultsData){
  this.questions = [];

  var lines = quizData.split("\n"),
      questionLines = [],
      i,
      line;

  for (i=0;i<lines.length;i++){
    line = PaktQuiz.escapeHTML(lines[i]);

    if (
      (PaktQuiz.startsWithNumber(line) && // new question?
       questionLines.length !== 0) || // not first question?
        i == lines.length - 1         // last question?
    ){
      if (i == lines.length - 1) questionLines.push(line); // last question

      // we've discovered a whole question. initialize the question
      this.questions.push(
        new PaktQuiz.Question(questionLines.join("\n"), this, this.questions.length)
      );

      // start the buffer for the next question
      questionLines = [line];
    } else if (line == "") {
      // empty line
      continue;
    } else {
      // not a new question, so add line to the current question
      questionLines.push(line);
    }
  }
};

PaktQuiz.transitionTime = 500; // milliseconds

PaktQuiz.startsWithNumberMatcher = new RegExp("^[0-9]+\.? ");
PaktQuiz.startsWithNumber = function(line){
  return line.match(PaktQuiz.startsWithNumberMatcher) !== null;
};

PaktQuiz.escapeHTML = function(line) {
  return line.
    trim().
    replace(/“|”/g, '"').
    replace(/’/g, "'").
    replace(/&/g, "&amp;").
    replace(/</g, "&lt;").
    replace(/>/g, "&gt;").
    replace(/"/g, "&quot;").
    replace(/'/g, "&#039;").
    replace(/…/g, "...").
    replace(/&amp;#039;/g, "'");
};

PaktQuiz.getQueryStrings = function () {
  var assoc  = {};
  var decode = function (s) { return decodeURIComponent(s.replace(/\+/g, " ")); };
  var queryString = location.search.substring(1);
  var keyValues = queryString.split('&');

  for(var i in keyValues) {
    var key = keyValues[i].split('=');
    if (key.length > 1) {
      assoc[decode(key[0])] = decode(key[1]);
    }
  }

  return assoc;
};

PaktQuiz.prototype.render = function(){
  var quiz = this;
  this.element = document.createElement("ol");
  this.element.id = "pakt_quiz";

  var i;
  for (i=0;i<this.questions.length;i++){
    this.element.appendChild(this.questions[i].render());
  }

  this.resultsContainer = document.createElement("div");
  this.resultsContainer.id = "pakt_quiz_results";
  this.element.appendChild(this.resultsContainer);

  setTimeout(function(){
    this.forwardToQuestion(0);
  }.bind(this), 0);

  return this.element;
};

PaktQuiz.prototype.grade = function(){
  var i, points = 0, resultsSet = [], result;
  for (i=0;i<this.questions.length;i++){
    result = this.questions[i].serialize();
    points += this.questions[i].serialize(result);
    resultsSet.push(result);
  }

  var level = this.results.findLevel(points);
  this.resultsContainer.innerHTML = ""; // empty it
  this.resultsContainer.appendChild(level.render(resultsSet));

  setTimeout(function(){
    this.questions[this.currentQuestion].demote(0);
    level.element.style.top = "0";
  }.bind(this), 0);
};

PaktQuiz.prototype.forwardToQuestion = function(questionIndex){
  var currentQuestion = this.currentQuestion;
  this.currentQuestion = questionIndex;

  if (currentQuestion == 0 || !!currentQuestion) {
    this.questions[currentQuestion].demote();
  }

  this.questions[questionIndex].promote();
};

PaktQuiz.prototype.backwardToQuestion = function(questionIndex){
  var currentQuestion = this.currentQuestion;
  this.currentQuestion = questionIndex;

  if (currentQuestion == 0 || !!currentQuestion) {
    this.questions[currentQuestion].demote(true);
  }

  this.questions[questionIndex].promote(true);
};


PaktQuiz.encodeResults = function(resultsSet) {
  return resultsSet.join(",");
};

PaktQuiz.decodeResults = function(codedResults) {
  return codedResults.split(",");
};

PaktQuiz.baseUrl = "https://pakt.io/quiz";
PaktQuiz.shareUrl = function(resultsSet){
  return PaktQuiz.baseUrl + "?results=" + PaktQuiz.encodeResults(resultsSet);
};

PaktQuiz.Question = function(questionAndChoices, quiz, index){
  this.choices   = [];
  this.quiz      = quiz;
  this.index     = index;
  this.selection = null;
  this.scaleMin  = null;
  this.scaleMax  = null;

  var lines             = questionAndChoices.split("\n"),
      numberAndQuestion = lines.shift().trim(),
      extracted         = numberAndQuestion.match(PaktQuiz.Question.extractor);

  this.number = parseInt(extracted[1]) - 1;
  this.text = extracted[2].trim();

  var textAndImage = this.text.match(PaktQuiz.Question.imageFilenameExtractor);
  if (textAndImage){
    this.text = textAndImage[1];
    this.imageFilename = textAndImage[2];
    this.imageName = textAndImage[2].match(PaktQuiz.Question.imageNameExtractor)[1];
  }

  this.detectType();

  var i, line, choice;
  for (i=0;i<lines.length;i++){
    line = lines[i];
    if (line.trim() == "") continue;
    this.choices.push(new PaktQuiz.Choice(line, this, i));
  }
};

PaktQuiz.prototype.populateResults = function(resultsSet) {
  var question, input;

  for (var i=0;i<resultsSet.length;i++){
    question = this.questions[i];
    if (question){
      input = question.element.querySelectorAll("input[value=\"" + resultsSet[i] + "\"]");
      if (input[0]) input[0].checked = true;
    }
  }

  this.grade();
}

PaktQuiz.Question.scaleExtractor = new RegExp("a scale of ([0-9]+)\-([0-9]+)");
PaktQuiz.Question.prototype.detectType = function(){
  var scaleExtracted = this.text.match(PaktQuiz.Question.scaleExtractor);

  if (scaleExtracted !== null){
    this.type     = "scale";
    this.scaleMin = parseInt(scaleExtracted[1], 10);
    this.scaleMax = parseInt(scaleExtracted[2], 10);
  } else {
    this.type = "multiple_choice";
  }
};

PaktQuiz.Question.extractor = new RegExp("^([0-9]*).? (.*)$");
PaktQuiz.Question.imageFilenameExtractor = new RegExp("(.*) Image: ?(.*)$");
PaktQuiz.Question.imageNameExtractor = new RegExp(".*/(.*).{4}$");

PaktQuiz.Question.prototype.render = function(){
  var quizHeight = document.body.clientHeight;
  this.element = document.createElement("li");
  this.element.style.transition = "top " + (PaktQuiz.transitionTime / 1000) + "s" + "ease 0s";
  this.element.style.top = quizHeight + "px";

  var promptContainer = document.createElement("div");
  PaktQuiz.addClass(promptContainer, "pakt-quiz-question-prompt-container");
  PaktQuiz.addClass(promptContainer, "pakt-quiz-image-" + this.imageName);

  var responseContainer = document.createElement("div");
  PaktQuiz.addClass(responseContainer, "pakt-quiz-question-response-container");

  promptContainer.appendChild(this.renderPrompt());
  promptContainer.appendChild(this.renderImage());

  var choicesContainer = document.createElement("div");
  PaktQuiz.addClass(choicesContainer, "pakt-quiz-question-choices");

  PaktQuiz.addClass(this.element, "pakt-quiz-question");

  switch(this.type) {
  case "multiple_choice":
    PaktQuiz.addClass(this.element, "pakt-quiz-multiple-choice");
    choicesContainer.appendChild(this.renderAsMultipleChoice());
    break;
  case "scale":
    PaktQuiz.addClass(this.element, "pakt-quiz-scale");
    choicesContainer.appendChild(this.renderAsScale());
    break;
  }

  if (this.index !== 0) {
    responseContainer.appendChild(this.renderPreviousButton());
  }

  responseContainer.appendChild(choicesContainer);

  if (this.index !== this.quiz.questions.length - 1){
    this.nextButton = this.renderNextButton();
    responseContainer.appendChild(this.nextButton);
  } else {
    this.nextButton = this.renderGradeButton();
    responseContainer.appendChild(this.nextButton);
  }

  this.element.appendChild(promptContainer);
  this.element.appendChild(responseContainer);

  return this.element;
};

PaktQuiz.Question.prototype.renderPrompt = function(){
  var strong = document.createElement("strong");

  PaktQuiz.addClass(strong, "pakt-quiz-question-prompt");
  strong.innerHTML = this.text;

  return strong;
}

PaktQuiz.Question.prototype.renderAsMultipleChoice = function(){
  var div = document.createElement("div"), i;
  PaktQuiz.addClass(div, "pakt-quiz-question-type-multiple-choice");
  for (i=0;i<this.choices.length;i++){
    div.appendChild(this.choices[i].render(this.onChange.bind(this)));
  }

  return div;
};

PaktQuiz.Question.prototype.onChange = function(){
  PaktQuiz.addClass(this.nextButton, "pakt-quiz-visible");
};

PaktQuiz.Question.prototype.renderAsScale = function(){
  var div = document.createElement("div"), i;
  PaktQuiz.addClass(div, "pakt-quiz-question-type-scale");
  for (i=this.scaleMin;i<=this.scaleMax;i++){
    div.appendChild(new PaktQuiz.Scale(i, this, i-1).render(this.onChange.bind(this)));
  }

  return div;
};

PaktQuiz.Question.prototype.renderImage = function(){
  var container = document.createElement("div");
  var image = document.createElement("div");
  PaktQuiz.addClass(container, "pakt-quiz-question-image-container");
  PaktQuiz.addClass(image, "pakt-quiz-question-image");

  if (this.imageFilename){
    image.style.backgroundImage = "url('" + this.imageFilename + "')";
  }

  container.appendChild(image);
  return container;
};

PaktQuiz.Question.prototype.renderNextButton = function(){
  var question = this;
  var button = document.createElement("div");
  button.innerHTML = "Next";
  PaktQuiz.addClass(button, "pakt-quiz-button-next");

  button.onclick = function(){
    PaktQuiz.addClass(this.element, "navigated");
    this.forwardToQuestion(question.index + 1);
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.renderPreviousButton = function(){
  var question = this;
  var button = document.createElement("div");
  button.innerHTML = "Previous";
  PaktQuiz.addClass(button, "pakt-quiz-button-previous");

  button.onclick = function(){
    PaktQuiz.addClass(this.element, "navigated");
    this.backwardToQuestion(question.index - 1);
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.renderGradeButton = function() {
  var gradeButton = document.createElement("div");
  gradeButton.innerHTML = "Grade";
  gradeButton.className = "pakt-quiz-button-grade";
  gradeButton.onclick = function(){
    this.grade();
  }.bind(this.quiz);

  return gradeButton;
};

PaktQuiz.Question.prototype.serialize = function(){
  var inputs = this.element.getElementsByTagName("input");

  var i;
  for (i=0;i<inputs.length;i++){
    if (inputs[i].checked) return parseInt(inputs[i].value, 10);
  }

  return 0;
};

PaktQuiz.Question.prototype.demote = function(isReversed){
  var quizHeight = this.quiz.element.offsetHeight;

  PaktQuiz.removeClass(this.element, "pakt-quiz-promoted");
  PaktQuiz.addClass(this.element, "pakt-quiz-demoting");

  var top = quizHeight + "px";
  if (!isReversed) top = "-" + top;
  this.element.style.top = top;

  setTimeout(function(){
    PaktQuiz.removeClass(this.element, "pakt-quiz-demoting");
  }.bind(this), PaktQuiz.transitionTime);
};

PaktQuiz.Question.prototype.promote = function(isReversed){
  var quizHeight = this.quiz.element.offsetHeight;

  PaktQuiz.addClass(this.element, "pakt-quiz-promoting");
  PaktQuiz.removeClass(this.element, "pakt-quiz-demoted");

  var top = quizHeight + "px";
  if (isReversed) top = "-" + top;
  this.element.style.top = top;

  setTimeout(function(){
    PaktQuiz.removeClass(this.element, "pakt-quiz-promoting");
    PaktQuiz.addClass(this.element, "pakt-quiz-promoted");
    this.element.style.top = "0";
  }.bind(this), 0);
};

PaktQuiz.Choice = function(textAndValue, question, number){
  this.question = question;
  this.number   = number;

  var split = textAndValue.split(":");
  this.text = split[0];
  this.value = parseInt(split[1].trim(), 10);
};

PaktQuiz.hasClass = function(el, className) {
  if (el.classList){
    return el.classList.contains(className);
  } else {
    return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
  }
};

PaktQuiz.addClass = function(el, className) {
  if (el.classList) {
    el.classList.add(className);
  } else if (!hasClass(el, className)) {
    el.className += " " + className;
  }
};

PaktQuiz.removeClass = function(el, className) {
  if (el.classList) {
    el.classList.remove(className);
  } else if (hasClass(el, className)) {
    var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
    el.className=el.className.replace(reg, ' ');
  }
};

PaktQuiz.Choice.prototype.id = function(){
  return "pakt_quiz_question_" + this.question.number + "_" + this.number;
};

PaktQuiz.Choice.prototype.name = function(){
  return "question_" + this.question.number;
};

PaktQuiz.Choice.prototype.renderLabel = function(){
  var l = document.createElement("label");
  var t = document.createElement("span");
  l.htmlFor = this.id();
  t.innerHTML = this.text;
  l.appendChild(t);
  return l;
};

PaktQuiz.Choice.prototype.renderInput = function(onChange){
  var i = document.createElement("input");
  i.type = "radio";
  i.id = this.id();
  i.name = this.name();
  i.value = this.value;
  i.addEventListener('change', onChange);

  return i;
};

PaktQuiz.Choice.prototype.render = function(onChange){
  this.element = document.createElement("p");
  this.input   = this.renderInput(onChange);

  this.element.appendChild(this.input);
  this.element.appendChild(this.renderLabel());
  return this.element;
};

PaktQuiz.Scale = function(value, question, number){
  this.value = value;
  this.question = question;
  this.number = number;
  this.text = value;
};

PaktQuiz.Scale.prototype.id = PaktQuiz.Choice.prototype.id;
PaktQuiz.Scale.prototype.name = PaktQuiz.Choice.prototype.name;
PaktQuiz.Scale.prototype.renderLabel = PaktQuiz.Choice.prototype.renderLabel;
PaktQuiz.Scale.prototype.renderInput = PaktQuiz.Choice.prototype.renderInput;
PaktQuiz.Scale.prototype.render = PaktQuiz.Choice.prototype.render;
PaktQuiz.Scale.prototype.render = PaktQuiz.Choice.prototype.render;
PaktQuiz.Scale.prototype.serialize = PaktQuiz.Choice.prototype.serialize;

PaktQuiz.Results = function(quiz, resultsData){
  this.levels = [];
  this.quiz = quiz;

  var lines = resultsData.split("\n"),
      levelLines = [],
      i,
      line,
      levels;

  for (i=0;i<lines.length;i++){
    line = PaktQuiz.escapeHTML(lines[i]);

    if (
      (PaktQuiz.Results.startsWithLevel(line) && // new level?
       levelLines.length !== 0) ||               // not first level?
        i == lines.length - 1                    // last level?
    ){
      if (i == lines.length - 1) levelLines.push(line); // last level

      // we've discovered levels. initialize the levels
      levels = PaktQuiz.Results.levelLinesToLevels(quiz, levelLines.join("\n"));
      this.levels = this.levels.concat(levels);

      // start the buffer for the next level
      levelLines = [line];
    } else if (line == "") {
      // empty line
      continue;
    } else {
      // not a new question, so add line to the current level
      levelLines.push(line);
    }
  }
};

PaktQuiz.Results.prototype.findLevel = function(points){
  var i;
  for (i=0;i<this.levels.length;i++){
    if (this.levels[i].doesMatch(points)) return this.levels[i];
  }

  return null;
};

PaktQuiz.Results.startsWithLevelDetector = new RegExp("Level (.*):");
PaktQuiz.Results.startsWithLevel = function(line){
  var levelsResults = line.match(PaktQuiz.Results.startsWithLevelDetector);
  return !!levelsResults;
};

PaktQuiz.Results.extractor = new RegExp("Level(.*):(.*) +\\(([0-9\-\, ]*)\\) Image: ?(.*)$");
PaktQuiz.Results.levelLinesToLevels = function(quiz, levelLines){
  levelLines = PaktQuiz.escapeHTML(levelLines);

  var lines          = levelLines.split("\n");
  var titleAndLevels = lines.shift();
  var extracted      = titleAndLevels.match(PaktQuiz.Results.extractor);
  var levels         = extracted[1].split("-");
  var title          = extracted[2];
  var ranges         = extracted[3].split(",");
  var imageUrl       = extracted[4];

  var out = [], i;
  for (i=0;i<levels.length;i++){
    out.push(
      new PaktQuiz.Results.Level(quiz, levels[i], ranges[i], title, lines.join("\n"), imageUrl)
    );
  }

  return out;
};

PaktQuiz.Results.Level = function(quiz, level, rangeText, title, description, imageUrl){
  var range        = rangeText.split("-");
  this.level       = parseInt(level.trim(), 10);
  this.low         = parseInt(range[0].trim(), 10);
  this.high        = parseInt(range[1].trim(), 10);
  this.title       = title.trim();
  this.description = description.trim();
  this.imageUrl    = imageUrl;
  this.quiz        = quiz;
  this.index       = quiz.questions.length;
};

PaktQuiz.Results.Level.prototype.render = function(resultsSet){
  var quizHeight = document.body.clientHeight;
  this.element = document.createElement("div");
  this.element.style.transition = "top " + (PaktQuiz.transitionTime / 1000) + "s" + "ease 0s";
  this.element.style.top = quizHeight + "px";

  PaktQuiz.addClass(this.element, "pakt-quiz-result");

  this.element.appendChild(this.renderBadgeContainer());
  this.element.appendChild(this.renderDescriptionContainer(resultsSet));

  return this.element;
};

PaktQuiz.Results.Level.prototype.renderBadgeContainer = function() {
  var badgeContainer = document.createElement("div");
  PaktQuiz.addClass(badgeContainer, "pakt-quiz-results-badge-container");

  var badgeImage = document.createElement("img");
  badgeImage.src = this.imageUrl;
  PaktQuiz.addClass(badgeImage, "pakt-quiz-results-badge-image");
  badgeContainer.appendChild(badgeImage);

  return badgeContainer;
};

PaktQuiz.Results.Level.prototype.renderDescriptionContainer = function(resultsSet) {
  var descriptionContainer = document.createElement("div");
  PaktQuiz.addClass(descriptionContainer, "pakt-quiz-results-description-container");

  descriptionContainer.appendChild(this.renderPreviousButton());

  var levelContainer = document.createElement("h3");
  PaktQuiz.addClass(levelContainer, "pakt-quiz-results-level-title");
  var levelText = document.createElement("span");
  levelText.innerHTML = "Level " + this.level;

  var levelTitle = document.createElement("span");
  levelTitle.innerHTML = this.title;

  levelContainer.appendChild(levelText);
  levelContainer.appendChild(document.createElement("br"));
  levelContainer.appendChild(levelTitle);
  descriptionContainer.appendChild(levelContainer);

  var descriptionText = document.createElement("p");
  descriptionText.innerHTML = this.description;
  PaktQuiz.addClass(descriptionText, "pakt-quiz-results-description");
  descriptionContainer.appendChild(descriptionText);

  descriptionContainer.appendChild(this.renderSharingTools(resultsSet));

  return descriptionContainer;
};

PaktQuiz.Results.Level.prototype.renderSharingTools = function(resultsSet) {
  var shareUrl = PaktQuiz.shareUrl(resultsSet);

  var sharingTools = document.createElement("div");
  PaktQuiz.addClass(sharingTools, "pakt-quiz-results-sharing-tools");

  var shareText = document.createElement("h4");
  PaktQuiz.addClass(shareText, "pakt-quiz-results-share-title");
  shareText.innerHTML = "Share your results!";
  sharingTools.appendChild(shareText);

  var socialLinks = document.createElement("div");
  PaktQuiz.addClass(socialLinks, "pakt-quiz-social-links");

  var facebookLink = document.createElement("a");
  facebookLink.href = "https://www.facebook.com/sharer/sharer.php?u=" +
                      encodeURIComponent(shareUrl);
  facebookLink.target = "_blank";
  facebookLink.innerHTML = "Facebook";
  PaktQuiz.addClass(facebookLink, "pakt-quiz-facebook-share");
  socialLinks.appendChild(facebookLink);

  var twitterLink = document.createElement("a");
  twitterLink.href = "http://twitter.com/share?text=" +
                     encodeURIComponent("My Pakt Coffee Quiz results!") +
                     "&url=" + encodeURIComponent(shareUrl);
  twitterLink.target = "_blank";
  twitterLink.innerHTML = "Twitter";
  PaktQuiz.addClass(twitterLink, "pakt-quiz-twitter-share");
  socialLinks.appendChild(twitterLink);

  sharingTools.appendChild(socialLinks);
  return sharingTools;
};

PaktQuiz.Results.Level.prototype.renderPreviousButton = PaktQuiz.Question.prototype.renderPreviousButton;

PaktQuiz.Results.Level.prototype.doesMatch = function(points){
  if (points < this.low)  return false;
  if (points > this.high) return false;
  return true;
};

window.onload = function(){
  var quizData = document.getElementById("pakt_quiz").innerHTML.trim();
  var quizResultsData = document.getElementById("pakt_quiz_results").innerHTML.trim();

  var quiz = new PaktQuiz(quizData, quizResultsData);
  window.paktQuiz = quiz;
  document.body.appendChild(quiz.render());

  quiz.results = new PaktQuiz.Results(quiz, quizResultsData);

  setTimeout(function(){
    var pastResults = PaktQuiz.getQueryStrings()["results"];
    if (pastResults) quiz.populateResults(PaktQuiz.decodeResults(pastResults));
  }, 0);
};
