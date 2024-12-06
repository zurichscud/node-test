const { SerialPort } = require('serialport')
const { DelimiterParser } = require('@serialport/parser-delimiter')

class WeightReader {
    constructor(portPath, options = {}) {
        this.portPath = portPath;  // 保存端口路径
        this.options = {
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            ...options
        };
        
        this.port = null;  // 初始化时不创建端口实例
        this.parser = null;
        this.isReading = false;
        this.lastWeight = null;
        this.sameWeightCount = 0;
        this.weightPromise = null;
        this.weightResolve = null;
    }

    async open() {
        try {
            this.port = new SerialPort({
                path: this.portPath,
                ...this.options
            });
            
            // 创建解析器
            this.parser = this.port.pipe(new DelimiterParser({ 
                delimiter: Buffer.from([0x03, 0x04, 0x00]) 
            }));
            
            // 等待端口打开
            await new Promise((resolve, reject) => {
                this.port.on('open', resolve);
                this.port.on('error', reject);
            });
            
            console.log('Port opened successfully');
            return true;
        } catch (error) {
            console.error('Failed to open port:', error);
            throw error;
        }
    }

    startReading() {
        this.stopReading(); // 先停止之前的读取
        
        this.weightPromise = new Promise((resolve) => {
            this.weightResolve = resolve;
        });
        this.parser.on('data', this.handleData.bind(this));
        this.port.on('error', this.handleError.bind(this));
        this.isReading = true;
        
        return this.weightPromise;
    }

    stopReading() {
        if (this.isReading) {
            this.parser.removeAllListeners('data')
            this.port.removeAllListeners('error')
            this.isReading = false
            this.weightPromise = null
            this.weightResolve = null
            this.lastWeight = null
            this.sameWeightCount = 0
            console.log('Stop Success');
            
        }
    }

    handleData(data) {
        try {
            // 检查数据包最小长度 (协议头+S+空格+重量)
            const minLength = 2 + 2 + 6; // 10字节
            if (data.length < minLength) {
                console.warn('Incomplete data package, skipping...')
                return
            }

            // 如果数据长度超过一个完整包的长度，说明可能有数据合并
            const expectedLength = 16  // 整数据包的长度
            if (data.length > expectedLength) {
                console.warn('Multiple data packages detected, skipping...')
                return
            }

            // 检查协议头
            if (data[0] !== 0x01 || data[1] !== 0x02) {
                console.warn('Invalid protocol header, skipping...')
                return
            }

            // 检查'S '标识
            if (data[2] !== 0x53 || data[3] !== 0x20) {
                console.warn('Invalid data identifier, skipping...')
                return
            }

            // 直接读取重量数据
            const weightStr = data.slice(4, 10).toString('ascii')
            const weight = parseFloat(weightStr)

            // 只有在成功解析数据后才进行处理
            if (!isNaN(weight)) {
                console.log({
                    weight,
                    rawData: data.toString('hex')
                })

                // 检查连续相同重量
                if (this.lastWeight === weight) {
                    this.sameWeightCount++
                    if (this.sameWeightCount >= 5 && this.weightResolve) {
                        this.weightResolve(weight)
                        this.stopReading() // 获取到稳定重量后停止读取
                    }
                } else {
                    this.sameWeightCount = 1
                    this.lastWeight = weight
                }
            }

            // 这里可以添加回调或事件发射器通知数据接收方
        } catch (error) {
            console.error('Data parsing error:', error)
        }
    }

    handleError(error) {
        console.error('Serial port error:', error)
    }

    close() {
        if (this.port.isOpen) {
            this.port.close()
            console.log('Close Success');
            
        }
    }
}

module.exports = WeightReader

