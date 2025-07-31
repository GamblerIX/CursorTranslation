const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Cursor 版本验证器
 * 支持全版本 Cursor 的检测和验证
 */
class VersionValidator {
    /**
     * 检测 Cursor 版本信息
     * @param {string} cursorPath Cursor 安装路径
     * @returns {Object} 版本信息对象
     */
    static detectCursorVersion(cursorPath) {
        const versionInfo = {
            version: 'unknown',
            buildNumber: 'unknown',
            isSupported: false,
            targetFiles: [],
            issues: [],
            suggestions: []
        };

        try {
            const packageJsonPath = this.findPackageJson(cursorPath);
            if (packageJsonPath) {
                const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                versionInfo.version = packageData.version || 'unknown';
                versionInfo.buildNumber = packageData.build || 'unknown';
            }

            const targetFiles = this.findTargetFiles(cursorPath);
            versionInfo.targetFiles = targetFiles;
            versionInfo.isSupported = targetFiles.length > 0;

            if (!versionInfo.isSupported) {
                versionInfo.issues.push('未找到支持的目标文件');
                versionInfo.suggestions.push('请确认 Cursor 版本或尝试手动指定目标文件');
            }

            console.log(`检测到 Cursor 版本: ${versionInfo.version}`);
            console.log(`构建号: ${versionInfo.buildNumber}`);
            console.log(`支持状态: ${versionInfo.isSupported ? '支持' : '不支持'}`);

        } catch (error) {
            console.error(`版本检测失败: ${error.message}`);
            versionInfo.issues.push(`版本检测失败: ${error.message}`);
        }

        return versionInfo;
    }

    /**
     * 查找 package.json 文件
     * @param {string} cursorPath Cursor 安装路径
     * @returns {string|null} package.json 路径
     */
    static findPackageJson(cursorPath) {
        const possiblePaths = [
            path.join(cursorPath, 'package.json'),
            path.join(cursorPath, 'resources', 'app', 'package.json'),
            path.join(cursorPath, 'Contents', 'Resources', 'app', 'package.json')
        ];

        for (const packagePath of possiblePaths) {
            if (fs.existsSync(packagePath)) {
                console.log(`找到 package.json: ${packagePath}`);
                return packagePath;
            }
        }

        console.warn('未找到 package.json 文件');
        return null;
    }

    /**
     * 查找所有可能的目标文件
     * @param {string} cursorPath Cursor 安装路径
     * @returns {Array} 目标文件数组
     */
    static findTargetFiles(cursorPath) {
        const targetFiles = [];
        const platform = os.platform();
        
        let appPath;
        if (platform === 'darwin') {
            appPath = path.join(cursorPath, 'Contents', 'Resources', 'app');
        } else {
            appPath = path.join(cursorPath, 'resources', 'app');
        }

        const possibleTargets = [
            path.join(appPath, 'out', 'vs', 'workbench', 'workbench.desktop.main.js'),
            path.join(appPath, 'out', 'vs', 'workbench', 'workbench.web.main.js'),
            path.join(appPath, 'out', 'vs', 'workbench', 'workbench.main.js'),
            path.join(appPath, 'out', 'main.js'),
            path.join(appPath, 'dist', 'main.js'),
            path.join(appPath, 'src', 'main.js')
        ];

        for (const targetPath of possibleTargets) {
            if (fs.existsSync(targetPath)) {
                targetFiles.push({
                    path: targetPath,
                    size: fs.statSync(targetPath).size,
                    type: this.getFileType(targetPath)
                });

            }
        }

        return targetFiles;
    }

    /**
     * 获取文件类型
     * @param {string} filePath 文件路径
     * @returns {string} 文件类型
     */
    static getFileType(filePath) {
        const fileName = path.basename(filePath);
        if (fileName.includes('workbench.desktop')) return 'desktop';
        if (fileName.includes('workbench.web')) return 'web';
        if (fileName.includes('workbench')) return 'workbench';
        if (fileName.includes('main')) return 'main';
        return 'unknown';
    }

    /**
     * 验证版本兼容性
     * @param {Object} versionInfo 版本信息
     * @returns {Object} 兼容性验证结果
     */
    static validateCompatibility(versionInfo) {
        const result = {
            isCompatible: false,
            confidence: 0,
            recommendations: [],
            warnings: []
        };

        if (versionInfo.targetFiles.length === 0) {
            result.recommendations.push('未找到可用的目标文件，请检查 Cursor 安装');
            return result;
        }

        result.isCompatible = true;
        result.confidence = Math.min(versionInfo.targetFiles.length * 25, 100);

        if (versionInfo.version !== 'unknown') {
            const versionNumber = this.parseVersion(versionInfo.version);
            if (versionNumber >= 1.0) {
                result.confidence = Math.min(result.confidence + 20, 100);
            }
        }

        if (result.confidence < 50) {
            result.warnings.push('兼容性置信度较低，建议谨慎使用');
        }

        if (versionInfo.targetFiles.length > 1) {
            result.recommendations.push('检测到多个目标文件，将使用最佳匹配');
        }

        return result;
    }

    /**
     * 解析版本号
     * @param {string} versionString 版本字符串
     * @returns {number} 版本号
     */
    static parseVersion(versionString) {
        const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (match) {
            return parseFloat(`${match[1]}.${match[2]}`);
        }
        return 0;
    }

    /**
     * 选择最佳目标文件
     * @param {Array} targetFiles 目标文件数组
     * @returns {Object|null} 最佳目标文件
     */
    static selectBestTarget(targetFiles) {
        if (targetFiles.length === 0) return null;
        if (targetFiles.length === 1) return targetFiles[0];

        const priorities = {
            'desktop': 100,
            'workbench': 80,
            'main': 60,
            'web': 40,
            'unknown': 20
        };

        return targetFiles.reduce((best, current) => {
            const currentPriority = priorities[current.type] || 0;
            const bestPriority = priorities[best.type] || 0;
            return currentPriority > bestPriority ? current : best;
        });
    }

    /**
     * 生成版本验证报告
     * @param {string} cursorPath Cursor 安装路径
     * @returns {Object} 完整的验证报告
     */
    static generateValidationReport(cursorPath) {
        console.log('[VERSION] 开始生成版本验证报告...');
        
        const report = {
            timestamp: new Date().toISOString(),
            cursorPath: cursorPath,
            platform: os.platform(),
            versionInfo: null,
            compatibility: null,
            bestTarget: null,
            recommendations: [],
            summary: ''
        };

        try {
            report.versionInfo = this.detectCursorVersion(cursorPath);
            report.compatibility = this.validateCompatibility(report.versionInfo);
            report.bestTarget = this.selectBestTarget(report.versionInfo.targetFiles);

            if (report.compatibility.isCompatible) {
                report.summary = `Cursor 版本 ${report.versionInfo.version} 兼容性验证通过 (置信度: ${report.compatibility.confidence}%)`;
            } else {
                report.summary = '版本兼容性验证失败，可能无法正常使用汉化功能';
            }

            report.recommendations = [
                ...report.versionInfo.suggestions,
                ...report.compatibility.recommendations
            ];

            console.log('版本验证报告生成完成');
            
        } catch (error) {
            console.error(`生成验证报告失败: ${error.message}`);
            report.summary = `验证失败: ${error.message}`;
        }

        return report;
    }

    /**
     * 打印验证报告
     * @param {Object} report 验证报告
     */
    static printReport(report) {
        console.log('\n' + '='.repeat(60));
        console.log('              Cursor 版本验证报告              ');
        console.log('='.repeat(60));
        
        console.log(`\n【基本信息】`);
        console.log(`Cursor 路径: ${report.cursorPath}`);
        console.log(`操作系统: ${report.platform}`);
        console.log(`检测时间: ${new Date(report.timestamp).toLocaleString()}`);
        
        if (report.versionInfo) {
            console.log(`\n【版本信息】`);
            console.log(`版本号: ${report.versionInfo.version}`);
            console.log(`构建号: ${report.versionInfo.buildNumber}`);
            console.log(`支持状态: ${report.versionInfo.isSupported ? '✓ 支持' : '✗ 不支持'}`);
            console.log(`目标文件数量: ${report.versionInfo.targetFiles.length}`);
        }
        
        if (report.compatibility) {
            console.log(`\n【兼容性评估】`);
            console.log(`兼容性: ${report.compatibility.isCompatible ? '✓ 兼容' : '✗ 不兼容'}`);
            console.log(`置信度: ${report.compatibility.confidence}%`);
        }
        
        if (report.bestTarget) {
            console.log(`\n【推荐目标文件】`);
            console.log(`文件路径: ${report.bestTarget.path}`);
            console.log(`文件类型: ${report.bestTarget.type}`);
            console.log(`文件大小: ${(report.bestTarget.size / 1024 / 1024).toFixed(2)} MB`);
        }
        
        if (report.recommendations.length > 0) {
            console.log(`\n【建议】`);
            report.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }
        
        console.log(`\n【总结】`);
        console.log(report.summary);
        console.log('\n' + '='.repeat(60));
    }
}

function main() {
    const args = process.argv.slice(2);
    const customPath = args[0];
    
    // 简化的路径查找逻辑
    let cursorPath = customPath;
    if (!cursorPath) {
        // 默认路径检测
        const defaultPaths = [
            path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor'),
            'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\cursor',
            '/Applications/Cursor.app',
            '/usr/local/bin/cursor'
        ];
        
        for (const testPath of defaultPaths) {
            if (fs.existsSync(testPath)) {
                cursorPath = testPath;
                break;
            }
        }
    }
    
    if (!cursorPath || !fs.existsSync(cursorPath)) {
        console.error('无法找到 Cursor 安装路径');
        process.exit(1);
    }
    
    const report = VersionValidator.generateValidationReport(cursorPath);
    VersionValidator.printReport(report);
    
    if (!report.compatibility?.isCompatible) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { VersionValidator };