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
 
console.log(parseQuery("https://avatars1.githubusercontent.com/u/22697565?v=4&s=120"));

```