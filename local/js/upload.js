var Upload = function (files) {
  this.files = files;
};
Upload.prototype.doUpload = function (success, failure) {
  var that = this;
  var formData = new FormData();

  for (var i = 0; i < this.files.length; i++) {
    formData.append("uploadedFiles", this.files[i]);
  }
  formData.append("upload_file", true);

  $.ajax({
    type: "POST",
    url: "upload",
    xhr: function () {
      var myXhr = $.ajaxSettings.xhr();
      if (myXhr.upload) {
        myXhr.upload.addEventListener('progress', that.progressHandling, false);
      }
      return myXhr;
    },
    success: function (data) {
      success(data);
    },
    error: function (error) {
      failure(error);
    },
    async: true,
    data: formData,
    cache: false,
    contentType: false,
    processData: false,
    timeout: 600000
  });
};

Upload.prototype.progressHandling = function (event) {
  var percent = 0;
  var position = event.loaded || event.position;
  var total = event.total;
  var progress_bar_id = "#progress-wrp";
  if (event.lengthComputable) {
      percent = Math.ceil(position / total * 100);
  }
  // update progressbars classes so it fits your code
  $(progress_bar_id + " .progress-bar").css("width", +percent + "%");
  $(progress_bar_id + " .status").text(percent + "%");
};