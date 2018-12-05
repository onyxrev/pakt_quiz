var PaktQuiz = function(quizData){
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
        new PaktQuiz.Question(questionLines.join("\n"))
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
    replace(/'/g, "&#039;");
};

PaktQuiz.prototype.render = function(){
  var quiz = this;
  this.elem = document.createElement("ol");
  this.elem.id = "pakt_quiz";

  var i;
  for (i=0;i<this.questions.length;i++){
    this.elem.appendChild(this.questions[i].render());
  }

  var gradeButton = document.createElement("button");
  gradeButton.innerHTML = "Grade";
  gradeButton.onclick = function(){
    alert("Grade: " + quiz.grade());
  };

  this.elem.appendChild(gradeButton);

  return this.elem;
};

PaktQuiz.prototype.grade = function(){
  var i, grade = 0;
  for (i=0;i<this.questions.length;i++){
    grade += this.questions[i].serialize();
  }

  return grade;
};

PaktQuiz.Question = function(questionAndChoices){
  this.choices = [];
  this.selection = null;
  this.scaleMin = null;
  this.scaleMax = null;

  var lines             = questionAndChoices.split("\n"),
      numberAndQuestion = lines.shift().trim(),
      extracted         = numberAndQuestion.match(PaktQuiz.Question.extractor);

  this.number = parseInt(extracted[1]) - 1;
  this.text = extracted[2].trim();

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

PaktQuiz.Question.prototype.render = function(){
  this.element = document.createElement("li");
  this.element.appendChild(this.renderPrompt());

  switch(this.type) {
  case "multiple_choice":
    this.element.appendChild(this.renderAsMultipleChoice());
    break;
  case "scale":
    this.element.appendChild(this.renderAsScale());
    break;
  }

  return this.element;
};

PaktQuiz.Question.prototype.renderPrompt = function(){
  var s = document.createElement("strong");
  s.innerHTML = (this.number + 1) + ". " + this.text;

  return s;
}

PaktQuiz.Question.prototype.renderAsMultipleChoice = function(){
  var d = document.createElement("div"), i;
  for (i=0;i<this.choices.length;i++){
    d.appendChild(this.choices[i].render());
  }

  return d;
};

PaktQuiz.Question.prototype.renderAsScale = function(){
  var d = document.createElement("div"), i;
  for (i=this.scaleMin;i<=this.scaleMax;i++){
    d.appendChild(new PaktQuiz.Scale(i, this, i-1).render());
  }

  return d;
};

PaktQuiz.Question.prototype.serialize = function(){
  var inputs = this.element.getElementsByTagName('input');

  var i;
  for (i=0;i<inputs.length;i++){
    if (inputs[i].checked) return parseInt(inputs[i].value, 10);
  }

  return 0;
};

PaktQuiz.Choice = function(textAndValue, question, number){
  this.question = question;
  this.number   = number;

  var split = textAndValue.split(":");
  this.text = split[0];
  this.value = parseInt(split[1].trim(), 10);
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

window.onload = function(){
  var quizData = document.getElementById("pakt_quiz").innerHTML.trim();

  var quiz = new PaktQuiz(quizData);
  document.body.appendChild(quiz.render());
};
