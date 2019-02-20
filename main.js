var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    // close all the accordions
    for (j = 0; j < acc.length; j++) {
      acc[j].classList.remove("active");
      var panel = acc[j].nextElementSibling;
      if (panel.style.display === "block") {
        panel.style.display = "none";
      }
    }
    this.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
    }
  });
}