
$(window).load(function () {  

  /*********************************
   * Recommendation Code
   */
  let allRecommendations;
  function populateRecommendations(fetch = true) {
    let recommendationList = $("#recommendation-list");
    recommendationList.empty();
    let p = document.createElement("p");
    p.innerHTML = "Loading";
    recommendationList.append(p);

    function populate(results) {
      allRecommendations = results;
      recommendations = allRecommendations;

      let recommendationList = $("#recommendation-list");
      recommendationList.empty();

      recommendations = recommendations.sort(function(a, b) {
        a.measure > b.measure ? -1 : 1;
      });

      recommendations.forEach((recommendation) => {
        let p = document.createElement("p");
        p.setAttribute("class", "recommendation-p");
        p.setAttribute("filename", currentPdfFilename);
        p.setAttribute("pdf-id", 0);
        p.setAttribute("startpage", recommendation.start_page);
        p.innerHTML = recommendation.text;
        recommendationList.append(p);
      });
    };

    if(fetch || !recommendations || !recommendations.length) {
      getRecommendations(populate, (err) =>{
        console.error("Could not get PDFs from Server: "+err);
      });
    } else {
      populate(allRecommendations);
    }
  }

  let lastClickedRecommendation = {};
  $("#recommendation-list").on('click', '.recommendation-p', function() {
    lastClickedRecommendation = {
      filename:this.getAttribute("filename"),
      pdfId:this.getAttribute("pdf-id"),
      page:parseInt(this.getAttribute("startpage")),
      text:this.innerHTML
    }
    showPDF(
      lastClickedRecommendation.filename, 
      lastClickedRecommendation.pdfId, 
      lastClickedRecommendation.page);
    if(currentPdfFilename == lastClickedRecommendation.filename) {
      // PDF will not load and trigger this, so just call it here.
      highlightPdf();
    } 
    $('html, body').animate({ scrollTop: 0 }, 'fast');
    
  });

  /**********************************
   * PDF code
   */
  let currentPdfFilename;
  let currentPdfId;
  let waitingOnLoad = false;
  
  function showPDF(filename, id, page_num) {
    let pdf_url = "/pdf/"+filename;
    currentPdfFilename = filename;
    currentPdfId = id;
    $("#pdf-iframe").attr(
      'src', 
      "libs/pdfjs/web/viewer.html?file=" + pdf_url + "#page=" + (page_num?page_num:1));
  }

  function highlightPdf() {
    waitingOnLoad = false;
    if(currentPdfFilename == lastClickedRecommendation.filename) {  
      let divs = getDivsForText(lastClickedRecommendation.text); 
      if(divs == null) {
        //Prevent multiple wait loops
        if(!waitingOnLoad) {
          waitingOnLoad = true;
          setTimeout(highlightPdf, 300);
        }
      } else {
        if(divs.length == 0) {
          console.error("Highlighting error for: "+lastClickedRecommendation.text);
        }
        // TODO: Fix the issue where it highlights the entire line regardless of where the 
        // text starts or ends
        divs.forEach(div => {
          $(div).css("background-color", "red");
        });
      }   
    }

    if(currentPdfFilename == lastClickedSource.filename) {  
      let divs = getDivsForText(lastClickedSource.text); 
      if(divs == null) {
        //Prevent multiple wait loops
        if(!waitingOnLoad) {
          waitingOnLoad = true;
          setTimeout(highlightPdf, 300);
        }
      } else {
        if(divs.length == 0) {
          console.error("Highlighting error for: "+lastClickedSource.text);
        }
        // TODO: Fix the issue where it highlights the entire line regardless of where the 
        // text starts or ends
        divs.forEach(div => {
          $(div).css("background-color", "green");
        });
      }   
    }


  }

  let mutationObserver;
  let iframeBody;
  $("#pdf-iframe").load(()=>{
    if(mutationObserver) mutationObserver.disconnect();

    iframeBody = $("#pdf-iframe").contents().find('body').get()[0];
    if(!iframeBody) {
      console.error("Iframe body didn't load!");
      return;
    }

    // Options for the observer (which mutations to observe)
    let config = { childList: true, subtree: true };

    mutationObserver = new MutationObserver(()=>{
      highlightPdf();
    });
    mutationObserver.observe(iframeBody, config);    
  });

  // Upon click this should should trigger click on the #file-to-upload file input element
  // This is better than showing the not-good-looking file input element
  $("#upload-button").on('click', function() {
      $("#file-to-upload").trigger('click');
  });

  $("#file-to-upload").on('change', function() {
      for(let i = 0; i < $("#file-to-upload").get(0).files.length; i++) {
        if(['application/pdf'].indexOf($("#file-to-upload").get(0).files[i].type) == -1) {
            alert('Error : Not a PDF');
            console.log("Following file is not a PDF:");
            console.log($("#file-to-upload").get(0).files[i]);
            return;
        }
      }

      $("#pdf-contents").hide();

      const files = $("#file-to-upload").get(0).files;
      const upload = new Upload(files);

      upload.doUpload((results)=>{
        showPDF(results.name);
        populateRecommendations();
      }, (error)=>{
          alert(error.responseText);
      });
  });

  function getPdfList(success, failure) {
    $.ajax({
      type: "GET",
      url: "pdflist",
      success: function (data) {
        success(data);
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
      url: "/recommendations?num=100",
      success: function (data) {
        success(data);
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


  /**********************************
   * Tagging Source Code
   */
  function getIframeSelectionText(iframe) {
    let win = iframe.contentWindow;
    let doc = iframe.contentDocument || win.document;
  
    if (win.getSelection) {
      return win.getSelection().toString();
    } else if (doc.selection && doc.selection.createRange) {
      return doc.selection.createRange().text;
    }
  }
  
  let lastSelectedText = null;
  $('#pdf-iframe').load(function(){
    let iframe = $('#pdf-iframe').contents();
    iframe.find("#viewerContainer").mouseup(function(event){
      let text = getIframeSelectionText(document.getElementById("pdf-iframe"));
  
      if(text) {
        lastSelectedText = text;
        $("#tag-source").css("display", "block");
        $("#tag-source").css("top", event.pageY);
        $("#tag-source").css("left", event.pageX);
      } else {
        $("#tag-source").css("display", "none");
      }
    });
  });

  $('#tag-source').click(function(){
    if(lastSelectedText) {
      let text = lastSelectedText;
      let pdf = currentPdfId;
      let page = getPageForText(lastSelectedText);
      uploadSource(text, page, pdf).then(()=>{
        populateSources();
      }).catch((err) => {
        console.error(err);
      });
    } else {
      console.error("shouldn't be able to get here...")
      console.log(text);
    }
    $("#tag-source").css("display", "none");
  });

  let sources;
  function populateSources() {
    getSources((results) =>{
      console.log(results);
      let sourceList = $("#source-list");
      sourceList.empty();
      sources = results.sort(function(a, b) {
        var textA = a.filename.toUpperCase();
        var textB = b.filename.toUpperCase();
        return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
      });
      let lastPDFname;
      sources.forEach((source) => {
        if(lastPDFname != source.filename) {
          let label = document.createElement("div");
          label.setAttribute("class", "label");
          label.innerHTML = source.filename;
          sourceList.append(label);
          lastPDFname = source.filename;
        }
        let p = document.createElement("p");
        p.setAttribute("class", "source-p");
        p.setAttribute("filename", source.filename);
        p.setAttribute("pdf-id", source.pdf);
        p.setAttribute("startpage", source.start_page);
        p.innerHTML = source.source_text;

        $(p).append("<br>");

        let input = document.createElement("input")
        input.setAttribute("type", "text");
        input.setAttribute("value", source.answer || "");
        input.setAttribute("source-id", source.id);    
        $(input).change(function() {
          updateAnswer($(this).attr("source-id"), $(this).val(), ()=>{
            console.log("Answer updated successfully");
          });
        })
        $(p).append(input);

        let button = document.createElement("button")
        button.innerHTML = "<i class='material-icons'>delete</i>";
        button.setAttribute("style", "background-color:#FFAAAA");
        button.setAttribute("source-id", source.id);
        $(button).click(function(){
          $(this).parent().remove();
          deleteSource($(this).attr("source-id"), ()=>{
            populateSources();
          });
        })
        $(p).append(button);

        sourceList.append(p);
      });
    }, (err) =>{
      console.error("Could not get Sources from Server: "+err);
    });
  }
  populateSources();
  
  let lastClickedSource = {};
  $("#source-list").on('click', '.source-p', function() {
    lastClickedSource = {
      filename:this.getAttribute("filename"),
      pdfId:this.getAttribute("pdf-id"),
      page:parseInt(this.getAttribute("startpage")),
      text:this.innerHTML
    }
    showPDF(
      lastClickedSource.filename, 
      lastClickedSource.pdfId, 
      lastClickedSource.page);
    if(currentPdfFilename == lastClickedSource.filename) {
      highlightPdf();
    } 
    $('html, body').animate({ scrollTop: 0 }, 'fast');
    
  });

  function getDivsForText(text) {
    let divs;
    divs = $("#pdf-iframe").contents()
      .find(".textLayer")
      .find("div");

    if(divs.length == 0) {
      return null;
    }

    // Remove whitespace as it behaves funny.
    let textwows = text.replace(/\s/g,'');
    let potentialDivs = [];
    divs.each((i, div) => {
      let sentenceSplit = div.innerHTML.match(/([^\.!\?]+[\.!\?]+)|([^\.!\?]+$)/g);
      let push = false;
      if(sentenceSplit) {
        sentenceSplit.forEach(sentence => {
          if(sentence.replace(/\s/g,'').length > 0 && 
              textwows.includes(sentence.replace(/\s/g,''))) {
            push = true;
          }
        });
        if(push) potentialDivs.push(div);
      }
    });

    let sets = [];
    let currentSet = [];
    while(potentialDivs.length > 0) {
      let div = potentialDivs.shift();
      if($(currentSet[currentSet.length-1]).is($(div.previousSibling))) {
        currentSet.push(div);
      } else {
        sets.push(currentSet);
        currentSet = [div];
      }
    }
    sets.push(currentSet);

    //TODO: Take the set that has the closest character count.
    let finalSet = [];
    sets.forEach((set) =>{
      if(set.length > finalSet.length) {
        finalSet = set;
      }  
    });

    return finalSet;
  }

  function getPageForText(text){
    let divs = getDivsForText(text);
    if(!divs) return null;
    let num = $(divs[0]).parents(".page").attr("data-page-number");
    if(!num) return null;
    num = parseInt(num);
    if(isNaN(num))
    return null;
    return num;
  }

  function uploadSource(sourceText, sourcePage, sourcePdfId) {
    return new Promise((resolve, reject) =>{
      $.ajax({
        url: "/insertsource",
        type: "get", //send it through get method
        data: { 
          text: sourceText, 
          page_num: sourcePage, 
          pdf_id: sourcePdfId
        },
        success: function(response) {
          resolve(response);
        },
        error: function(error) {
          reject(error);
        }
      });
    })
  }

    
  function getSources(success, failure) {
    $.ajax({
      type: "GET",
      // The number of recommendations to get.
      url: "/sources",
      success: function (data) {
        success(data);
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

  function updateAnswer(sourceId, text, success) {
    $.ajax({
      type: "GET",
      // The number of recommendations to get.
      url: "/updateanswer",
      data: { 
        text: text, 
        source_id: sourceId
      },
      success: function (data) {
        success(data);
      },
      error: function (error) {
        console.error(error);
      }
    });
  }

  function deleteSource(sourceId, success) {
    $.ajax({
      type: "GET",
      // The number of recommendations to get.
      url: "/deletesource",
      success: function (data) {
        success(data);
      },
      error: function (error) {
        console.error(error);
      },
      data: { 
        source_id: sourceId
      }
    });
  }

  /*********************************
   * Popup Window Code
   */
  function populatePdfList() {
    getPdfList((pdfs)=>{
      pdfs = pdfs.sort(function(a, b) {
        var textA = a.filename.toUpperCase();
        var textB = b.filename.toUpperCase();
        return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
      });
      let pdfList = $("#all-pdfs-list");
      pdfList.empty();
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
  }
  populatePdfList();

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
    showPDF(
      this.getAttribute("filename"), 
      this.getAttribute("pdf-id"));
  });

});
