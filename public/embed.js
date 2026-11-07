/* InsideGov chart embeds: resizes an embedded chart's iframe to fit the chart.
 * Optional; the iframe works at its fixed height without it. Source: lib/embed.ts. */
(function () {
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.type !== "insidegov:embed-height" || typeof d.height !== "number") return;
    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = Math.ceil(d.height) + "px";
    }
  });
})();
