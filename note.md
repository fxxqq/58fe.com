```js
function parseQuery(url) {
    var queryObj={};
    var reg=/[?&]([^=&#]+)=([^&#]*)/g;
    var querys=decodeURIComponent(url).match(reg);
    if(querys){
        for(var i in querys){
            var query=querys[i].split('=');
            var key=query[0].substr(1),
                value=query[1];
            queryObj[key]?queryObj[key]=decodeURIComponent([].concat(queryObj[key],value)):queryObj[key]=decodeURIComponent(value);
        }
    }
    return queryObj;
}
 
console.log(parseQuery("https://github.com/login?client_id=Iv1.fcfd34a22b3237ac&return_to=%2Flogin%2Foauth%2Fauthorize%3Fclient_id%3DIv1.fcfd34a22b3237ac%26redirect_uri%3Dhttp%253A%252F%252F127.0.0.1%253A7001%252Fpassport%252Fgithub%252Fcallback%26response_type%3Dcode"));

```