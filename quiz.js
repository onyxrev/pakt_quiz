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

  this.results = new PaktQuiz.Results(quizResultsData);
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

PaktQuiz.prototype.render = function(){
  var quiz = this;
  this.element = document.createElement("ol");
  this.element.id = "pakt_quiz";

  var i;
  for (i=0;i<this.questions.length;i++){
    this.element.appendChild(this.questions[i].render());
  }

  var gradeButton = document.createElement("button");
  gradeButton.innerHTML = "Grade";
  gradeButton.className = "pakt-quiz-grade-button";
  gradeButton.onclick = function(){
    alert("Grade: " + quiz.grade());
  };

  this.element.appendChild(gradeButton);

  setTimeout(function(){
    this.forwardToQuestion(0);
  }.bind(this), 0);

  return this.element;
};

PaktQuiz.prototype.grade = function(){
  var i, points = 0;
  for (i=0;i<this.questions.length;i++){
    points += this.questions[i].serialize();
  }

  var grade = this.results.findLevel(points);
  return grade.title;
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
  }

  this.detectType();

  var i, line, choice;
  for (i=0;i<lines.length;i++){
    line = lines[i];
    if (line.trim() == "") continue;
    this.choices.push(new PaktQuiz.Choice(line, this, i));
  }
};

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

PaktQuiz.Question.prototype.render = function(){
  this.element = document.createElement("li");

  if (this.index !== 0) {
    this.element.appendChild(this.renderPreviousButton());
  }

  if (this.index !== this.quiz.questions.length - 1){
    this.element.appendChild(this.renderNextButton());
  }

  this.element.style.transition = "left " + (PaktQuiz.transitionTime / 1000) + "s";
  this.element.appendChild(this.renderPrompt());
  this.element.appendChild(this.renderImage());

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

  this.element.appendChild(choicesContainer);
  return this.element;
};

PaktQuiz.Question.prototype.renderPrompt = function(){
  var strong = document.createElement("strong");

  PaktQuiz.addClass(strong, "pakt-quiz-question-prompt");
  strong.innerHTML = (this.number + 1) + ". " + this.text;

  return strong;
}

PaktQuiz.Question.prototype.renderAsMultipleChoice = function(){
  var div = document.createElement("div"), i;
  for (i=0;i<this.choices.length;i++){
    div.appendChild(this.choices[i].render());
  }

  return div;
};

PaktQuiz.Question.prototype.renderAsScale = function(){
  var div = document.createElement("div"), i;
  for (i=this.scaleMin;i<=this.scaleMax;i++){
    div.appendChild(new PaktQuiz.Scale(i, this, i-1).render());
  }

  return div;
};

PaktQuiz.Question.prototype.renderImage = function(){
  var container = document.createElement("div");
  PaktQuiz.addClass(container, "pakt-quiz-question-image");

  if (this.imageFilename){
    container.style.backgroundImage = "url('" + this.imageFilename + "')";
  }

  return container;
};

PaktQuiz.Question.prototype.renderNextButton = function(){
  var button = document.createElement("button");
  button.innerHTML = "Next";

  button.onclick = function(){
    PaktQuiz.addClass(this.element, "navigated");
    this.forwardToQuestion(this.currentQuestion + 1);
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.renderPreviousButton = function(){
  var button = document.createElement("button");
  button.innerHTML = "Previous";

  button.onclick = function(){
    PaktQuiz.addClass(this.element, "navigated");
    this.backwardToQuestion(this.currentQuestion - 1);
  }.bind(this.quiz);

  return button;
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
  var quizWidth = this.quiz.element.offsetWidth;

  PaktQuiz.removeClass(this.element, "pakt-quiz-promoted");
  PaktQuiz.addClass(this.element, "pakt-quiz-demoting");

  var left = quizWidth + "px";
  if (!isReversed) left = "-" + left;
  this.element.style.left = left;

  setTimeout(function(){
    PaktQuiz.removeClass(this.element, "pakt-quiz-demoting");
  }.bind(this), PaktQuiz.transitionTime);
};

PaktQuiz.Question.prototype.promote = function(isReversed){
  var quizWidth = this.quiz.element.offsetWidth;

  PaktQuiz.addClass(this.element, "pakt-quiz-promoting");
  PaktQuiz.removeClass(this.element, "pakt-quiz-demoted");

  var left = quizWidth + "px";
  if (isReversed) left = "-" + left;
  this.element.style.left = left;

  setTimeout(function(){
    PaktQuiz.removeClass(this.element, "pakt-quiz-promoting");
    PaktQuiz.addClass(this.element, "pakt-quiz-promoted");
    this.element.style.left = "0";
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
  l.htmlFor = this.id();
  l.innerHTML = this.text;

  return l;
};

PaktQuiz.Choice.prototype.renderInput = function(){
  var i = document.createElement("input");
  i.type = "radio";
  i.id = this.id();
  i.name = this.name();
  i.value = this.value;

  return i;
};

PaktQuiz.Choice.prototype.render = function(){
  this.element = document.createElement("p");
  this.input   = this.renderInput();

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
PaktQuiz.Scale.prototype.serialize = PaktQuiz.Choice.prototype.serialize;

PaktQuiz.Results = function(resultsData){
  this.levels = [];

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
      // we've discovered levels. initialize the levels
      levels = PaktQuiz.Results.levelLinesToLevels(levelLines.join("\n"));
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

PaktQuiz.Results.extractor = new RegExp("Level(.*):(.*) +\\(([0-9\-\, ]*)\\)");
PaktQuiz.Results.levelLinesToLevels = function(levelLines){
  levelLines = PaktQuiz.escapeHTML(levelLines);

  var lines          = levelLines.split("\n");
  var titleAndLevels = lines.shift();
  var extracted      = titleAndLevels.match(PaktQuiz.Results.extractor);
  var levels         = extracted[1].split("-");
  var title          = extracted[2];
  var ranges         = extracted[3].split(",");

  var out = [], i;
  for (i=0;i<levels.length;i++){
    out.push(
      new PaktQuiz.Results.Level(levels[i], ranges[i], title, lines.join("\n"))
    );
  }

  return out;
};

PaktQuiz.Results.Level = function(level, rangeText, title, description){
  var range        = rangeText.split("-");
  this.level       = parseInt(level.trim(), 10);
  this.low         = parseInt(range[0].trim(), 10);
  this.high        = parseInt(range[1].trim(), 10);
  this.title       = title.trim();
  this.description = description.trim();
};

PaktQuiz.Results.Level.prototype.doesMatch = function(points){
  if (points < this.low)  return false;
  if (points > this.high) return false;
  return true;
};

window.onload = function(){
  var quizData = document.getElementById("pakt_quiz").innerHTML.trim();
  var quizResultsData = document.getElementById("pakt_quiz_results").innerHTML.trim();

  var quiz = new PaktQuiz(quizData, quizResultsData);
  document.body.appendChild(quiz.render());
};
