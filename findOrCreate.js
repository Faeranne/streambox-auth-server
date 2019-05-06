module.exports = function(lowdash){
  lowdash.mixin({
      findOrCreate: function(obj,query){
        const _query = lowdash.find(obj,query)
        if(_query){
          return _query
        }else{
          obj.push(query)
          return lowdash.find(obj,query)
        }
      }
  })
}
