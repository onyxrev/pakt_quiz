(function(){
  var Quiz = function(quizData){
    this.questions = [];

    var lines = quizData.split("\n");

    var questionLines = [], i, line;
    for (i=0;i<lines.length;i++){
      line = lines[i];

      console.log(line);
      if (
        (Quiz.startsWithNumber(line) && questionLines.length !== 0) ||
          i == lines.length - 1
      ){
        console.log("yes");

        this.questions.push(
          new Question(questionLines.join("\n"))
        );
        questionLines = [];
      } else {
        console.log("no");
        questionLines.push(line);
      }
    }
  };

  Quiz.startsWithNumberMatcher = new RegExp("^[0-9]*.? ");

  Quiz.startsWithNumber = function(line){
    return line.match(Quiz.startsWithNumberMatcher) !== null;
  };

  var Question = function(questionAndChoices){
    this.choices = [];
    this.selection = null;

    var lines = questionAndChoices.split("\n");
    var i, line, choice;

    var numberAndQuestion = lines.shift().trim();
    var extracted = numberAndQuestion.match(Question.extractor);

    this.number = parseInt(extracted[1]);
    this.question = extracted[2].trim();

    for (i=0;i<lines.length;i++){
      line = lines[i];
      if (line.trim() == "") continue;
      this.choices.push(new Choice(line));
    }
  };

  Question.extractor = new RegExp("^([0-9]*).? (.*)$");

  var Choice = function(textAndValue){
    var split = textAndValue.split(":");
    this.text = split[0];
    this.value = parseInt(split[1].trim(), 10);
  };
})();
