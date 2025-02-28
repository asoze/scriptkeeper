$(document).ready(function () {
  $(".tab").on("click", function () {
    // Remove active state and hide content for all tabs
    $(".tab").removeClass("active");
    $(".tab-content").addClass("hidden");

    // Set the clicked tab as active and show its content
    $(this).addClass("active");
    $("#" + $(this).data("tab")).removeClass("hidden");
  });
});
