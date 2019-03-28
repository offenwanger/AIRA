
$(window).load(function () {
  /*********************************
   * Accordion Code
   */
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

  /*********************************
   * Popup Window Code
   */
  let pdfs = [];
  getPdfList((data)=>{
    pdfs = data.sort(function(a, b) {
      var textA = a.filename.toUpperCase();
      var textB = b.filename.toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
    let pdfList = $("#all-pdfs-list");
    pdfs.forEach((pdf) => {
      let link = document.createElement("a");
      link.setAttribute("pdf-id", pdf.id);
      link.setAttribute("filename", pdf.filename);
      link.setAttribute("class", "pdf-button");
      link.innerHTML = pdf.filename;
      pdfList.append(link);
    });
  }, (err) =>{
    console.error("Could not get PDFs from Server: "+err);
  });

  $("#see-all-pdfs").click(function(){
    $('#pdfs-popup').show();
  });
  $('#pdfs-popup').click(function(){
      $('#pdfs-popup').hide();
  });
  $('#pdfs-popup-close-button').click(function(){
      $('#pdfs-popup').hide();
  });
  $("#all-pdfs-list").on('click', '.pdf-button', function(){
    $('#pdfs-popup').hide();
    showPDF(this.getAttribute("filename"));
  });
  

  /*********************************
   * Recommendation Code
   */
  getRecommendations((results) =>{
    let recommendationList = $("#recommendation-list");
    // TODO: paginate the results.
    let recommendations = results.splice(0, 10);
    recommendations = recommendations.sort(function(a, b) {
      var textA = a.row.filename.toUpperCase();
      var textB = b.row.filename.toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
    let lastPDFname;
    recommendations.forEach((recommendation) => {
      if(lastPDFname != recommendation.row.filename) {
        let label = document.createElement("div");
        label.setAttribute("class", "label");
        label.innerHTML = recommendation.row.filename;
        recommendationList.append(label);
        lastPDFname = recommendation.row.filename;
      }
      let p = document.createElement("p");
      p.setAttribute("class", "source-p");
      p.setAttribute("filename", recommendation.row.filename);
      p.setAttribute("startpage", recommendation.row.start_page);
      p.innerHTML = recommendation.text;
      recommendationList.append(p);
    });
  }, (err) =>{
    console.error("Could not get PDFs from Server: "+err);
  });

  let lastClickedSource;

  $("#recommendation-list").on('click', '.source-p', function() {
    lastClickedSource = {
      filename:this.getAttribute("filename"),
      page:parseInt(this.getAttribute("startpage")),
      text:this.innerHTML
    }
    showPDF(lastClickedSource.filename, lastClickedSource.page);
    if(currentPdfFilename == lastClickedSource.filename) {
      // PDF will not load and trigger this, so just call it here.
      hilightLastClickedSource();
    } 
    $('html, body').animate({ scrollTop: 0 }, 'fast');
    
  });

  /**********************************
   * PDF codd
   */
  let currentPdfFilename;
  let waitingOnLoad = false;
  
  function showPDF(filename, page_num) {
    let pdf_url = "/pdf/"+filename;
    currentPdfFilename = filename;
    $("#pdf-iframe").attr(
      'src', 
      "libs/pdfjs/web/viewer.html?file=" + pdf_url + "#page=" + (page_num?page_num:1));
  }

  function hilightLastClickedSource() {
    waitingOnLoad = false;
    if(currentPdfFilename == lastClickedSource.filename) {   
      let divs;
      divs = $("#pdf-iframe").contents()
        .find("[data-page-number="+lastClickedSource.page+"]")
        .filter(".page")
        .find(".textLayer")
        .find("div");
      if(divs.length == 0) {
        //Prevent multiple wait loops
        if(!waitingOnLoad) {
          waitingOnLoad = true;
          setTimeout(hilightLastClickedSource, 300);
        }
      } else {
        // Remove whitespace as it behaves funny.
        let text = lastClickedSource.text.replace(/\s/g,'');
        divs.each((i, div) => {
          if(text.includes(div.innerHTML.replace(/\s/g,'')) && div.innerHTML.replace(/\s/g,'').length > 1) {
            $(div).css("background-color", "red");
          }
        });
        // zooming redraws the text layer, so when zoom is clicked, redraw the highlighting.
        $("#pdf-iframe").contents().find("#zoomIn").on("click", hilightLastClickedSource);
        $("#pdf-iframe").contents().find("#zoomOut").on("click", hilightLastClickedSource);
      }   
    }
  }

  $("#pdf-iframe").load(hilightLastClickedSource);

  // Upon click this should should trigger click on the #file-to-upload file input element
  // This is better than showing the not-good-looking file input element
  $("#upload-button").on('click', function() {
      $("#file-to-upload").trigger('click');
  });

  $("#file-to-upload").on('change', function() {
      if(['application/pdf'].indexOf($("#file-to-upload").get(0).files[0].type) == -1) {
          alert('Error : Not a PDF');
          return;
      }

      $("#pdf-contents").hide();

      const file = $("#file-to-upload").get(0).files[0];
      const upload = new Upload(file);

      upload.doUpload((filename)=>{
          showPDF(filename);
      }, (error)=>{
          alert(error.responseText);
      });
  });

  function getPdfList(success, failure) {
    $.ajax({
      type: "GET",
      url: "pdflist",
      success: function (data) {
        success(JSON.parse(data));
      },
      error: function (error) {
        failure(error);
      },
      async: true,
      cache: false,
      contentType: false,
      processData: false,
      timeout: 60000
    });
  }

  function getRecommendations(success, failure) {
    $.ajax({
      type: "GET",
      // The number of recommendations to get.
      url: "recommendations?num=100",
      success: function (data) {
        success(JSON.parse(data));
      },
      error: function (error) {
        failure(error);
      },
      async: true,
      cache: false,
      contentType: false,
      processData: false,
      timeout: 60000
    });
  }
});
