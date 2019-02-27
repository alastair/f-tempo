
// On submitting form for image upload, handle the file uploads.
$('#uploadForm').on('submit', function (event) {
    event.preventDefault();
    // Get the files from input, create new FormData.
    var files = $('#file-id').get(0).files,
        formData = new FormData();
    if (files.length === 0) {
        alert('Select a file to upload.');
        return false;
    }
    if (files.length > 1) {
        alert('You can only upload 1 file.');
        return false;
    }
    // Append the files to the formData.
    for (var i=0; i < files.length; i++) {
        var file = files[i];
        formData.append('user_image', file, file.name);
    }

    // Note: We are only appending the file inputs to the FormData.
    uploadFiles(formData);
});

/**
 * Upload the photos using ajax request.
 *
 * @param formData
 */
function uploadFiles(formData) {
    document.getElementById("result_img_display").innerHTML = "Searching ...";
    $.ajax({
        url: 'api/image_query',
        method: 'post',
        data: formData,
        processData: false,
        contentType: false,
        xhr: function () {
            var xhr = new XMLHttpRequest();

            // Add progress event listener to the upload.
            xhr.upload.addEventListener('progress', function (event) {
                var progressBar = $('.progress-bar');

                if (event.lengthComputable) {
                    var percent = (event.loaded / event.total) * 100;
                    progressBar.width(percent + '%');

                    if (percent === 100) {
                        progressBar.removeClass('active');
                    }
                }
            });

            return xhr;
        }
    }).done(handleSuccess).fail(function (xhr, status) {
        alert(status);
    });
}
/**
 * Handle the upload response data from server and display them.
 *
 * @param data
 */
function handleSuccess(data) {
    console.log("Returned: "+data)
    show_post_results(data)
}
function readURL(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            selected_image = input.files[0];
            hide_result_table();
            load_page_query_image(selected_image);
            console.log(input.files[0].name+ " selected")
            $('#img_display').empty();
            $('#img_display').prepend($('<img>',{id:'query_image',src: e.target.result}));
            $('#img_display').zoom();
        }
        reader.readAsDataURL(input.files[0]);
    }
}
$("#file-id").change(function() {
    readURL(this);
});

