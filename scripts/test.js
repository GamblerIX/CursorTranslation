const fs = require('fs');
const path = require('path');
const { Logger, FileUtils, CursorPathFinder } = require('./apply.js');

/**
 * 测试工具类
 */
class TestRunner {
    /**
     * 运行所有测试
     */
    static runAllTests() {
        console.log('[TEST] 开始运行测试...\n');
        
        const tests = [
            this.testLogger,
            this.testFileUtils,
            this.testCursorPathFinder,
            this.testTranslationFile
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const test of tests) {
            try {
                const result = test();
                if (result) {
                    passed++;
                    Logger.success(`[PASS] ${test.name} 通过`);
                } else {
                    failed++;
                    Logger.error(`[FAIL] ${test.name} 失败`);
                }
            } catch (error) {
                failed++;
                Logger.error(`[ERROR] ${test.name} 异常: ${error.message}`);
            }
        }
        
        console.log(`\n[RESULT] 测试结果: ${passed} 通过, ${failed} 失败`);
        return failed === 0;
    }
    
    /**
     * 测试日志工具
     */
    static testLogger() {
        // 测试日志方法不会抛出异常
        Logger.info('测试信息');
        Logger.success('测试成功');
        Logger.warning('测试警告');
        Logger.error('测试错误');
        Logger.step('测试步骤');
        return true;
    }
    
    /**
     * 测试文件工具
     */
    static testFileUtils() {
        const testFile = path.join(__dirname, 'test_temp.txt');
        const testContent = 'Hello World 测试内容\n'.repeat(100); // 确保文件大小超过1KB
        
        try {
            // 测试写入文件
            const writeResult = FileUtils.safeWriteFile(testFile, testContent);
            if (!writeResult) return false;
            
            // 测试读取文件
            const readContent = FileUtils.safeReadFile(testFile);
            if (readContent !== testContent) return false;
            
            // 测试文件验证（非JS文件）
            const isValid = FileUtils.validateFile(testFile, false);
            if (!isValid) return false;
            
            // 清理测试文件
            fs.unlinkSync(testFile);
            
            return true;
        } catch (error) {
            // 清理测试文件（如果存在）
            if (fs.existsSync(testFile)) {
                fs.unlinkSync(testFile);
            }
            return false;
        }
    }
    
    /**
     * 测试路径查找器
     */
    static testCursorPathFinder() {
        // 测试获取潜在路径
        const platform = require('os').platform();
        const paths = CursorPathFinder.getPotentialPaths(platform);
        
        if (!Array.isArray(paths)) return false;
        if (paths.length === 0) return false;
        
        // 测试平台路径获取（使用模拟路径）
        const mockPath = '/mock/cursor/path';
        const platformPaths = CursorPathFinder.getPlatformPaths(mockPath);
        
        if (!platformPaths.appPath || !platformPaths.targetFile || !platformPaths.backupFile) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 测试翻译文件
     */
    static testTranslationFile() {
        const translationFile = path.join(__dirname, '..', 'translations', 'zh-cn.json');
        
        if (!fs.existsSync(translationFile)) {
            Logger.error('翻译文件不存在');
            return false;
        }
        
        try {
            const content = fs.readFileSync(translationFile, 'utf-8');
            const translations = JSON.parse(content);
            
            // 检查翻译文件结构
            if (typeof translations !== 'object') return false;
            
            // 检查是否有翻译内容
            const allTranslations = Object.values(translations).reduce((acc, group) => {
                return { ...acc, ...group };
            }, {});
            
            if (Object.keys(allTranslations).length === 0) return false;
            
            return true;
        } catch (error) {
            Logger.error(`解析翻译文件失败: ${error.message}`);
            return false;
        }
    }
}

/**
 * 主函数
 */
function main() {
    console.log('--- Cursor 汉化工具测试 ---\n');
    
    const success = TestRunner.runAllTests();
    
    if (success) {
        Logger.success('\n[SUCCESS] 所有测试通过！代码重构成功。');
        process.exit(0);
    } else {
        Logger.error('\n[FAIL] 部分测试失败，请检查代码。');
        process.exit(1);
    }
}

// 错误处理
process.on('uncaughtException', (error) => {
    Logger.error(`测试过程中发生未捕获的异常: ${error.message}`);
    process.exit(1);
});

if (require.main === module) {
    main();
}

module.exports = { TestRunner }; 