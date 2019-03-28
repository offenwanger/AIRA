
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
    showPDF("/pdf/"+this.getAttribute("filename"));
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
    showPDF("/pdf/"+this.getAttribute("filename"), parseInt(this.getAttribute("startpage")));
    $('html, body').animate({ scrollTop: 0 }, 'fast');
  });

  /**********************************
   * PDF codd
   */
  
  function showPDF(pdf_url, page_num) {
    $("#pdf-iframe").attr(
      'src', 
      "libs/pdfjs/web/viewer.html?file=" + pdf_url + "#page=" + (page_num?page_num:1));
  }

  let seeking = false;
  function onIframeLoad() {
    seeking = false;
    console.log("loaded");
    let divs;
    try {
      divs = $("#pdf-iframe").contents().find("[data-page-number=1]").filter(".page").find(".textLayer").find("div");
    } catch {}
    if(divs.length == 0) {
      if(!seeking) {
        seeking = true;
        setTimeout(onIframeLoad, 1000);
      }
    } else {
      console.log(divs);
    }

  }

  $("#pdf-iframe").load(onIframeLoad);

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
          showPDF("/pdf/"+filename);
      }, (error)=>{
          alert(error.responseText);
      });
  });

  // Previous page of the PDF
  $("#pdf-prev").on('click', function() {
      if(currentPage != 1)
          showPage(--currentPage);
  });

  // Next page of the PDF
  $("#pdf-next").on('click', function() {
      if(currentPage != totalPages)
          showPage(++currentPage);
  });

  $("#zoominbutton").on('click', function() {
     pdfScale = pdfScale + 0.25;
     showPage(currentPage);
  });

  $("#zoomoutbutton").on('click', function() {
     if (pdfScale <= 0.25) {
        return;
     }
     pdfScale = pdfScale - 0.25;
     showPage(currentPage);
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
