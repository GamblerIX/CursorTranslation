const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const { VersionValidator } = require('./version-validator.js');
const { CursorPathFinder } = require('./apply.js');

/**
 * Cursor 中文补丁工具统一控制台界面
 */
class CursorCLI {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.menuItems = [
            { id: '1', name: '应用汉化 (直接翻译模式)', command: 'npm run apply' },
            { id: '2', name: '应用汉化 (双语模式)', command: 'npm run apply:bilingual' },
            { id: '3', name: '还原英文界面', command: 'npm run restore' },
            { id: '4', name: '运行诊断检查', command: 'npm run diagnose' },
            { id: '5', name: '自动修复问题', command: 'npm run diagnose:fix' },
            { id: '6', name: '版本验证检查', handler: this.versionValidationHandler.bind(this) },
            { id: '7', name: '检测未翻译词条', command: 'npm run validate:missing' },
            { id: '8', name: '验证翻译文件', command: 'npm run validate' },
            { id: '9', name: '修复翻译文件问题', command: 'npm run validate:fix' },
            { id: '10', name: '合并翻译文件', command: 'npm run merge' },
            { id: '11', name: '自定义安装路径', handler: this.customPathHandler.bind(this) },
            { id: '12', name: '查看翻译统计', handler: this.showTranslationStats.bind(this) },
            { id: '13', name: '查看帮助文档', handler: this.showHelp.bind(this) },
            { id: '0', name: '退出', handler: this.exit.bind(this) }
        ];
    }

    /**
     * 显示欢迎信息和主菜单
     */
    async showMainMenu() {
        console.clear();
        this.printHeader();
        this.printMenu();
        await this.handleUserChoice();
    }

    /**
     * 打印头部信息
     */
    printHeader() {
        console.log('='.repeat(60));
        console.log('              Cursor 中文补丁工具 v2.1.0              ');
        console.log('                支持 Cursor 全版本                ');
        console.log('='.repeat(60));
        console.log('');
    }

    /**
     * 打印菜单选项
     */
    printMenu() {
        console.log('【功能菜单】\n');
        
        console.log('【汉化功能】');
        console.log('  1. 应用汉化 (直接翻译模式)');
        console.log('  2. 应用汉化 (双语模式)');
        console.log('  3. 还原英文界面');
        console.log('');
        
        console.log('【诊断与修复】');
        console.log('  4. 运行诊断检查');
        console.log('  5. 自动修复问题');
        console.log('  6. 版本验证检查');
        console.log('');
        
        console.log('【翻译管理】');
        console.log('  7. 检测未翻译词条');
        console.log('  8. 验证翻译文件');
        console.log('  9. 修复翻译文件问题');
        console.log('  10. 合并翻译文件');
        console.log('');
        
        console.log('【其他】');
        console.log('  11. 自定义安装路径');
        console.log('  12. 查看翻译统计');
        console.log('  13. 查看帮助文档');
        console.log('  0. 退出');
        console.log('');
    }

    /**
     * 处理用户选择
     */
    async handleUserChoice() {
        const choice = await this.askQuestion('请输入选项编号: ');
        const selectedItem = this.menuItems.find(item => item.id === choice);
        
        if (selectedItem) {
            if (selectedItem.handler) {
                await selectedItem.handler();
            } else if (selectedItem.command) {
                await this.runCommand(selectedItem.command);
            }
        } else {
            console.log('\n无效的选项，请重新选择\n');
            await this.waitForKeyPress();
        }
        
        // 如果不是退出选项，返回主菜单
        if (choice !== '0') {
            await this.showMainMenu();
        }
    }

    /**
     * 运行命令
     */
    async runCommand(command) {
        console.log(`\n执行命令: ${command}\n`);
        
        return new Promise((resolve) => {
            const parts = command.split(' ');
            const cmd = parts[0];
            const args = parts.slice(1);
            
            const process = spawn(cmd, args, { 
                cwd: this.projectRoot,
                shell: true,
                stdio: 'inherit'
            });
            
            process.on('close', async (code) => {
                console.log(`\n命令执行完成，退出码: ${code}\n`);
                await this.waitForKeyPress();
                resolve();
            });
        });
    }

    async versionValidationHandler() {
        console.log('\n【Cursor 版本验证检查】\n');
        
        const customPath = await this.askQuestion('请输入 Cursor 安装路径 (留空自动检测): ');
        
        try {
            let cursorPath;
            if (customPath && customPath.trim() !== '') {
                cursorPath = customPath.trim();
            } else {
                cursorPath = CursorPathFinder.findCursorPath();
                if (!cursorPath) {
                    console.log('\n❌ 无法自动检测 Cursor 安装路径');
                    await this.waitForKeyPress();
                    return;
                }
            }
            
            const report = VersionValidator.generateValidationReport(cursorPath);
            
            console.clear();
            VersionValidator.printReport(report);
            
            if (report.compatibility?.isCompatible) {
                console.log('\n✅ 版本验证通过，可以安全使用汉化功能');
                
                const applyNow = await this.askQuestion('\n是否立即应用汉化？(y/n): ');
                if (applyNow.toLowerCase() === 'y' || applyNow.toLowerCase() === 'yes') {
                    const mode = await this.askQuestion('选择模式 (1: 直接翻译, 2: 双语): ');
                    let command = `npm run apply -- "${cursorPath}"`;
                    
                    if (mode === '2') {
                        command = `npm run apply:bilingual -- "${cursorPath}"`;
                    }
                    
                    await this.runCommand(command);
                    return;
                }
            } else {
                console.log('\n⚠️  版本验证未通过，建议谨慎使用汉化功能');
                
                const forceApply = await this.askQuestion('\n是否强制应用汉化？(y/n): ');
                if (forceApply.toLowerCase() === 'y' || forceApply.toLowerCase() === 'yes') {
                    console.log('\n⚠️  强制模式可能导致 Cursor 无法正常工作');
                    const confirm = await this.askQuestion('确认继续？(y/n): ');
                    
                    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                        const mode = await this.askQuestion('选择模式 (1: 直接翻译, 2: 双语): ');
                        let command = `npm run apply -- "${cursorPath}"`;
                        
                        if (mode === '2') {
                            command = `npm run apply:bilingual -- "${cursorPath}"`;
                        }
                        
                        await this.runCommand(command);
                        return;
                    }
                }
            }
            
        } catch (error) {
            console.log(`\n❌ 版本验证失败: ${error.message}`);
        }
        
        await this.waitForKeyPress();
    }

    /**
     * 自定义安装路径处理
     */
    async customPathHandler() {
        const customPath = await this.askQuestion('\n请输入 Cursor 安装路径: ');
        
        if (!customPath || customPath.trim() === '') {
            console.log('\n路径不能为空\n');
            await this.waitForKeyPress();
            return;
        }
        
        const mode = await this.askQuestion('选择模式 (1: 直接翻译, 2: 双语): ');
        let command = `npm run apply -- "${customPath}"`;
        
        if (mode === '2') {
            command = `npm run apply:bilingual -- "${customPath}"`;
        }
        
        await this.runCommand(command);
    }

    /**
     * 显示翻译统计
     */
    async showTranslationStats() {
        console.log('\n【翻译统计信息】\n');
        
        try {
            // 读取 zh-cn.json 文件
            const zhCnPath = path.join(this.projectRoot, 'translations', 'zh-cn.json');
            const zhCnContent = fs.readFileSync(zhCnPath, 'utf-8');
            const zhCnJson = JSON.parse(zhCnContent);
            
            // 统计分类和词条数量
            const categories = Object.keys(zhCnJson);
            let totalEntries = 0;
            let categoryCounts = {};
            
            categories.forEach(category => {
                const count = Object.keys(zhCnJson[category]).length;
                categoryCounts[category] = count;
                totalEntries += count;
            });
            
            // 检查是否存在 no.json 文件
            const noJsonPath = path.join(this.projectRoot, 'translations', 'no.json');
            let untranslatedCount = 0;
            
            if (fs.existsSync(noJsonPath)) {
                const noJsonContent = fs.readFileSync(noJsonPath, 'utf-8');
                const noJson = JSON.parse(noJsonContent);
                
                if (noJson.statistics && noJson.statistics.total_missing) {
                    untranslatedCount = noJson.statistics.total_missing;
                }
            }
            
            // 显示统计信息
            console.log(`总分类数: ${categories.length}`);
            console.log(`总词条数: ${totalEntries}`);
            console.log(`未翻译词条数: ${untranslatedCount}`);
            console.log(`翻译完成率: ${((totalEntries - untranslatedCount) / totalEntries * 100).toFixed(2)}%\n`);
            
            console.log('【分类详情】');
            Object.entries(categoryCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([category, count]) => {
                    console.log(`  ${category}: ${count} 个词条`);
                });
            
        } catch (error) {
            console.log(`获取翻译统计失败: ${error.message}`);
        }
        
        console.log('');
        await this.waitForKeyPress();
    }

    /**
     * 显示帮助文档
     */
    async showHelp() {
        console.log('\n【帮助文档】\n');
        console.log('1. 应用汉化 - 将 Cursor 界面翻译为中文');
        console.log('   - 直接翻译模式: 完全替换为中文');
        console.log('   - 双语模式: 保留英文原文，在下方显示中文翻译');
        console.log('');
        console.log('2. 诊断与修复 - 检测并修复常见问题');
        console.log('   - 运行诊断检查: 检测系统环境和文件完整性');
        console.log('   - 自动修复问题: 尝试自动修复检测到的问题');
        console.log('');
        console.log('3. 翻译管理 - 管理和优化翻译');
        console.log('   - 检测未翻译词条: 生成 no.json 文件，记录未翻译词条');
        console.log('   - 验证翻译文件: 检查翻译文件的完整性和格式');
        console.log('   - 修复翻译文件问题: 修复翻译文件中的常见问题');
        console.log('   - 合并翻译文件: 将 yes-zh-cn.json 合并到 zh-cn.json');
        console.log('');
        console.log('4. 质量与测试 - 确保代码和翻译质量');
        console.log('   - 质量检查: 全面检查代码和翻译质量');
        console.log('   - 快速质量检查: 快速检查主要质量指标');
        console.log('   - 性能测试: 测试工具的性能表现');
        console.log('   - 运行测试: 执行自动化测试');
        console.log('');
        console.log('5. 自定义安装路径 - 手动指定 Cursor 安装位置');
        console.log('   - Windows 示例: C:\\Users\\用户名\\AppData\\Local\\Programs\\Cursor');
        console.log('   - macOS 示例: /Applications/Cursor.app');
        console.log('   - Linux 示例: /usr/local/bin/cursor');
        console.log('');
        console.log('6. 文件说明');
        console.log('   - zh-cn.json: 主翻译文件');
        console.log('   - no.json: 未翻译词条清单');
        console.log('   - yes-zh-cn.json: 用户自定义翻译文件');
        console.log('');
        
        await this.waitForKeyPress();
    }

    /**
     * 等待用户按键
     */
    async waitForKeyPress() {
        console.log('按任意键继续...');
        
        return new Promise(resolve => {
            process.stdin.once('data', () => {
                resolve();
            });
        });
    }

    /**
     * 提问并获取用户输入
     */
    askQuestion(question) {
        return new Promise(resolve => {
            this.rl.question(question, answer => {
                resolve(answer);
            });
        });
    }

    /**
     * 退出程序
     */
    async exit() {
        console.log('\n感谢使用 Cursor 中文补丁工具！');
        this.rl.close();
        process.exit(0);
    }

    /**
     * 启动CLI
     */
    async start() {
        await this.showMainMenu();
    }
}

// 启动CLI
if (require.main === module) {
    const cli = new CursorCLI();
    cli.start().catch(error => {
        console.error(`发生错误: ${error.message}`);
        process.exit(1);
    });
}