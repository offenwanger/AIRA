
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

  $("#recommendation-list").on('click', '.source-p', function() {
    showPDF("/pdf/"+this.getAttribute("filename"), parseInt(this.getAttribute("startpage")));
  });

  /**********************************
   * PDF code
   */

  let __PDF_DOC,
  __CURRENT_PAGE,
  __TOTAL_PAGES,
  __PAGE_RENDERING_IN_PROGRESS = 0,
  __CANVAS = $('#pdf-canvas').get(0),
  __CANVAS_CTX = __CANVAS.getContext('2d');
  let pdfScale = 1;

  function showPDF(pdf_url, page_num) {
      $("#pdf-loader").show();

    PDFJS.getDocument({ url: pdf_url }).then(function(pdf_doc) {
        __PDF_DOC = pdf_doc;
        __TOTAL_PAGES = __PDF_DOC.numPages;
        
        // Hide the pdf loader and show pdf container in HTML
        $("#pdf-loader").hide();
        $("#pdf-contents").show();
        $("#pdf-total-pages").text(__TOTAL_PAGES);

        // Show the first page
        showPage(page_num?page_num:1);
    }).catch(function(error) {
        // If error re-show the upload button
        $("#pdf-loader").hide();
        $("#upload-button").show();
        
        alert(error.message);
    });
  }

  function showPage(page_no) {
    __PAGE_RENDERING_IN_PROGRESS = 1;
    __CURRENT_PAGE = page_no;

    // Disable Prev & Next buttons while page is being loaded
    $(".pdf-control").attr('disabled', 'disabled');

    // While page is being rendered hide the canvas and show a loading message
    $("#pdf-canvas").hide();
    $("#page-loader").show();

    // Update current page in HTML
    $("#pdf-current-page").text(page_no);

    // Fetch the page
    __PDF_DOC.getPage(page_no).then(function(page) {

        // Get viewport of the page at required scale
        var viewport = page.getViewport(pdfScale);

        // Set canvas height
        __CANVAS.height = viewport.height;

        var renderContext = {
            canvasContext: __CANVAS_CTX,
            viewport: viewport
        };
        
        // Render the page contents in the canvas
        page.render(renderContext).then(function() {
            __PAGE_RENDERING_IN_PROGRESS = 0;

            // Re-enable Prev & Next buttons
            $(".pdf-control").removeAttr('disabled');

            // Show the canvas and hide the page loader
            $("#pdf-canvas").show();
            $("#page-loader").hide();

            // Return the text contents of the page after the pdf has been rendered in the canvas
            return page.getTextContent();
        }).then(function(textContent) {
            // Get canvas offset
            var canvas_offset = $("#pdf-canvas").offset();

            // Clear HTML for text layer
            $("#text-layer").html('');

            // Assign the CSS created to the text-layer element
            $("#text-layer").css({ left: canvas_offset.left + 'px', top: canvas_offset.top + 'px', height: __CANVAS.height + 'px', width: __CANVAS.width + 'px' });

            // Pass the data to the method for rendering of text over the pdf canvas.
            PDFJS.renderTextLayer({
                textContent: textContent,
                container: $("#text-layer").get(0),
                viewport: viewport,
                textDivs: []
            });
        });
    });
  }
      
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
      if(__CURRENT_PAGE != 1)
          showPage(--__CURRENT_PAGE);
  });

  // Next page of the PDF
  $("#pdf-next").on('click', function() {
      if(__CURRENT_PAGE != __TOTAL_PAGES)
          showPage(++__CURRENT_PAGE);
  });

  $("#zoominbutton").on('click', function() {
     pdfScale = pdfScale + 0.25;
     showPage(__CURRENT_PAGE);
  });

  $("#zoomoutbutton").on('click', function() {
     if (pdfScale <= 0.25) {
        return;
     }
     pdfScale = pdfScale - 0.25;
     showPage(__CURRENT_PAGE);
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
