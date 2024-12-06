const WeightReader = require('./WeightReader');
const reader = new WeightReader('COM2');
async function getWeight() {
    try {
        reader.open()
        setTimeout(()=>{
            reader.stopReading()//只要被调用就可以中止读取
        },2000)
        const weight = await reader.startReading();
        console.log('稳定重量:', weight);
        return weight;
    } catch (error) {
        console.error('读取重量出错:', error);
    } finally {
        // reader.close();
    }
}
getWeight()
// 多次调用没有问题
setTimeout(async()=>{
    const res=await reader.startReading()
    console.log(res);
    reader.close()
},5000)