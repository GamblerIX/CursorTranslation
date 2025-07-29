const fs = require('fs');
const path = require('path');
const os = require('os');

// 复用apply.js中的工具类
const { Logger, FileUtils, CursorPathFinder } = require('./apply.js');

/**
 * 诊断工具类
 */
class Diagnoser {
    /**
     * 诊断Cursor安装状态
     * @param {string} cursorPath Cursor安装路径
     * @returns {Object} 诊断结果
     */
    static diagnoseCursorInstallation(cursorPath) {
        const result = {
            isValid: false,
            issues: [],
            suggestions: []
        };

        Logger.info('[DIAGNOSE] 开始诊断 Cursor 安装状态...');

        // 检查Cursor路径是否存在
        if (!fs.existsSync(cursorPath)) {
            result.issues.push(`Cursor 安装路径不存在: ${cursorPath}`);
            result.suggestions.push('请确认 Cursor 已正确安装');
            return result;
        }

        // 检查平台特定路径
        const { appPath, targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);
        
        if (!fs.existsSync(appPath)) {
            result.issues.push(`应用资源路径不存在: ${appPath}`);
            result.suggestions.push('Cursor 安装可能不完整，建议重新安装');
            return result;
        }

        if (!fs.existsSync(targetFile)) {
            result.issues.push(`核心文件不存在: ${targetFile}`);
            result.suggestions.push('Cursor 版本可能不兼容，请检查版本');
            return result;
        }

        // 验证文件完整性
        if (!FileUtils.validateFile(targetFile)) {
            result.issues.push('核心文件已损坏或格式不正确');
            result.suggestions.push('建议重新安装 Cursor');
            return result;
        }

        // 检查备份文件
        if (fs.existsSync(backupFile)) {
            if (!FileUtils.validateFile(backupFile)) {
                result.issues.push('备份文件已损坏');
                result.suggestions.push('建议删除备份文件并重新应用汉化');
            } else {
                Logger.success('备份文件状态正常');
            }
        } else {
            Logger.info('未找到备份文件（首次运行）');
        }

        result.isValid = true;
        Logger.success('Cursor 安装状态正常');
        return result;
    }

    /**
     * 修复常见问题
     * @param {string} cursorPath Cursor安装路径
     * @returns {boolean} 是否成功
     */
    static fixCommonIssues(cursorPath) {
        Logger.info('[FIX] 开始修复常见问题...');
        
        const { targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);
        let fixed = false;

        // 1. 修复损坏的备份文件
        if (fs.existsSync(backupFile) && !FileUtils.validateFile(backupFile)) {
            Logger.warning('检测到损坏的备份文件，正在删除...');
            try {
                fs.unlinkSync(backupFile);
                Logger.success('损坏的备份文件已删除');
                fixed = true;
            } catch (error) {
                Logger.error('删除损坏的备份文件失败');
            }
        }

        // 2. 修复损坏的目标文件
        if (fs.existsSync(targetFile) && !FileUtils.validateFile(targetFile)) {
            Logger.warning('检测到损坏的目标文件');
            
            // 尝试从备份恢复
            if (fs.existsSync(backupFile) && FileUtils.validateFile(backupFile)) {
                Logger.info('正在从备份文件恢复...');
                if (FileUtils.safeCopyFile(backupFile, targetFile)) {
                    Logger.success('已从备份文件恢复目标文件');
                    fixed = true;
                } else {
                    Logger.error('从备份恢复失败');
                }
            } else {
                Logger.error('无法修复损坏的目标文件，建议重新安装 Cursor');
                return false;
            }
        }

        // 3. 检查文件权限
        try {
            const stats = fs.statSync(targetFile);
            const isReadable = (stats.mode & fs.constants.R_OK) !== 0;
            const isWritable = (stats.mode & fs.constants.W_OK) !== 0;
            
            if (!isReadable || !isWritable) {
                Logger.warning('文件权限不足，建议以管理员身份运行');
                // result.suggestions.push('请以管理员身份运行此脚本'); // This line was removed from the original file, so it's removed here.
            }
        } catch (error) {
            Logger.error('无法检查文件权限');
        }

        if (fixed) {
            Logger.success('问题修复完成');
        } else {
            Logger.info('未发现需要修复的问题');
        }

        return true;
    }

    /**
     * 验证汉化状态
     * @param {string} cursorPath Cursor安装路径
     * @returns {Object} 验证结果
     */
    static verifyLocalization(cursorPath) {
        Logger.info('[VERIFY] 验证汉化状态...');
        
        const { targetFile, backupFile } = CursorPathFinder.getPlatformPaths(cursorPath);
        const result = {
            isLocalized: false,
            hasBackup: false,
            issues: []
        };

        // 检查是否有备份文件
        result.hasBackup = fs.existsSync(backupFile) && FileUtils.validateFile(backupFile);

        // 检查目标文件是否被汉化
        if (fs.existsSync(targetFile)) {
            const content = FileUtils.safeReadFile(targetFile);
            if (content) {
                // 检查是否包含中文字符
                const hasChinese = /[\u4e00-\u9fff]/.test(content);
                result.isLocalized = hasChinese;
                
                if (hasChinese) {
                    Logger.success('检测到汉化内容');
                } else {
                    Logger.info('未检测到汉化内容');
                }
            }
        }

        return result;
    }

    /**
     * 生成诊断报告
     * @param {string} cursorPath Cursor安装路径
     */
    static generateReport(cursorPath) {
        Logger.info('[REPORT] 生成诊断报告...');
        
        const installation = this.diagnoseCursorInstallation(cursorPath);
        const localization = this.verifyLocalization(cursorPath);
        
        console.log('\n' + '='.repeat(50));
        console.log('[REPORT] Cursor 汉化诊断报告');
        console.log('='.repeat(50));
        
        // 安装状态
        console.log('\n[STATUS] 安装状态:');
        if (installation.isValid) {
            console.log('  [OK] Cursor 安装正常');
        } else {
            console.log('  [ERROR] Cursor 安装存在问题');
            installation.issues.forEach(issue => console.log(`    - ${issue}`));
            installation.suggestions.forEach(suggestion => console.log(`    [TIP] ${suggestion}`));
        }
        
        // 汉化状态
        console.log('\n[LOCAL] 汉化状态:');
        if (localization.isLocalized) {
            console.log('  [OK] 已应用汉化补丁');
        } else {
            console.log('  [ERROR] 未检测到汉化内容');
        }
        
        if (localization.hasBackup) {
            console.log('  [OK] 备份文件存在');
        } else {
            console.log('  [WARN] 备份文件不存在');
        }
        
        // 建议
        console.log('\n[TIP] 建议:');
        if (!installation.isValid) {
            console.log('  1. 解决安装问题后再应用汉化');
        } else if (!localization.isLocalized) {
            console.log('  1. 运行 npm run apply 应用汉化');
        } else {
            console.log('  1. 汉化状态正常，无需操作');
        }
        
        if (!localization.hasBackup) {
            console.log('  2. 建议创建备份文件');
        }
        
        console.log('\n' + '='.repeat(50));
    }
}

/**
 * 主函数
 */
function main() {
    console.log('--- Cursor 汉化诊断工具 ---');
    
    const args = process.argv.slice(2);
    const pathArg = args.find(arg => !['fix', 'report'].includes(arg));
    const isFix = args.includes('fix');
    const isReport = args.includes('report');
    
    const cursorPath = CursorPathFinder.findCursorPath(pathArg);
    if (!cursorPath) {
        process.exit(1);
    }
    
    if (isFix) {
        Logger.info('模式: 修复问题');
        if (!Diagnoser.fixCommonIssues(cursorPath)) {
            process.exit(1);
        }
    }
    
    if (isReport || (!isFix && !isReport)) {
        Diagnoser.generateReport(cursorPath);
    }
    
    Logger.success('诊断完成');
}

// 错误处理
process.on('uncaughtException', (error) => {
    Logger.error(`未捕获的异常: ${error.message}`);
    process.exit(1);
});

if (require.main === module) {
    main();
}

module.exports = { Diagnoser }; 