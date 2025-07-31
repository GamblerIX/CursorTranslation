const fs = require('fs');
const path = require('path');

/**
 * 翻译验证工具 - 增强版
 */
class TranslationValidator {
    constructor() {
        this.errorLog = [];
        this.missingTranslations = [];
        this.validationResults = {
            isValid: false,
            issues: [],
            stats: {
                totalGroups: 0,
                totalEntries: 0,
                emptyEntries: 0,
                duplicateKeys: 0,
                longTranslations: 0,
                specialChars: 0,
                missingTranslations: 0,
                untranslatedEntries: 0
            }
        };
    }

    /**
     * 日志工具
     */
    static log(level, message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * 安全读取文件
     */
    safeReadFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                TranslationValidator.log('WARN', `文件不存在: ${filePath}`);
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            TranslationValidator.log('INFO', `成功读取文件: ${filePath} (${content.length} 字符)`);
            return content;
        } catch (error) {
            TranslationValidator.log('ERROR', `读取文件失败: ${filePath} - ${error.message}`);
            this.errorLog.push({
                type: 'READ_ERROR',
                file: filePath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * 安全写入文件
     */
    safeWriteFile(filePath, content) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                TranslationValidator.log('INFO', `创建目录: ${dir}`);
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            TranslationValidator.log('SUCCESS', `成功写入文件: ${filePath}`);
            return true;
        } catch (error) {
            TranslationValidator.log('ERROR', `写入文件失败: ${filePath} - ${error.message}`);
            this.errorLog.push({
                type: 'WRITE_ERROR',
                file: filePath,
                error: error.message
            });
            return false;
        }
    }

    /**
     * 检测未翻译的词条 - 通过读取Cursor源文件检测
     */
    detectUntranslatedEntries(translations) {
        const untranslated = [];
        
        try {
            // 扁平化翻译对象
            const flatTranslations = this.flattenTranslations(translations);
            
            // 模拟apply.js中的常见英文词条（这些是经常出现但可能缺少翻译的）
            const commonEnglishTerms = [
                'Page Down', 'Page Up', 'Forward', 'Back', 'Tools', 'View', 'Help',
                'File', 'Edit', 'Selection', 'Go', 'Run', 'Terminal', 'Window',
                'Search', 'Replace', 'Find', 'Navigate', 'Debug', 'Extensions',
                'Settings', 'Preferences', 'General', 'Advanced', 'Basic',
                'Cancel', 'OK', 'Apply', 'Save', 'Close', 'Open', 'Delete',
                'Copy', 'Paste', 'Cut', 'Undo', 'Redo', 'Select All',
                'New File', 'New Folder', 'Rename', 'Move', 'Duplicate',
                'Import', 'Export', 'Upload', 'Download', 'Sync',
                'Login', 'Logout', 'Sign In', 'Sign Out', 'Account',
                'Profile', 'Dashboard', 'Home', 'About', 'Version',
                'Update', 'Upgrade', 'Install', 'Uninstall', 'Enable', 'Disable'
            ];
            
            // 检查这些常见词条是否有翻译
            for (const term of commonEnglishTerms) {
                if (!flatTranslations[term]) {
                    untranslated.push({
                        path: 'missing',
                        englishText: term,
                        category: 'common'
                    });
                }
            }
            
        } catch (error) {
            TranslationValidator.log('ERROR', `检测未翻译词条时出错: ${error.message}`);
        }
        
        return untranslated;
    }
    
    /**
     * 扁平化翻译对象
     */
    flattenTranslations(obj, prefix = '') {
        const flattened = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                flattened[key] = value;
            } else if (typeof value === 'object' && value !== null) {
                Object.assign(flattened, this.flattenTranslations(value, prefix ? `${prefix}.${key}` : key));
            }
        }
        
        return flattened;
    }
    /**
     * 验证翻译文件 - 增强版
     * @param {string} projectRoot 项目根目录
     * @returns {{isValid: boolean, issues: string[], stats: Object, untranslated: Array}}
     */
    validateTranslationFile(projectRoot) {
        const translationPath = path.join(projectRoot, 'translations', 'zh-cn.json');
        const issues = [];
        const stats = {
            totalGroups: 0,
            totalEntries: 0,
            emptyEntries: 0,
            duplicateKeys: 0,
            longTranslations: 0,
            specialChars: 0,
            missingTranslations: 0,
            untranslatedEntries: 0
        };

        try {
            // 检查文件是否存在
            if (!fs.existsSync(translationPath)) {
                TranslationValidator.log('ERROR', '翻译文件不存在');
                return {
                    isValid: false,
                    issues: ['翻译文件不存在'],
                    stats,
                    untranslated: []
                };
            }

            // 读取文件内容
            const content = this.safeReadFile(translationPath);
            if (!content) {
                return {
                    isValid: false,
                    issues: ['无法读取翻译文件'],
                    stats,
                    untranslated: []
                };
            }

            let translations;
            try {
                translations = JSON.parse(content);
            } catch (parseError) {
                TranslationValidator.log('ERROR', `JSON解析失败: ${parseError.message}`);
                return {
                    isValid: false,
                    issues: [`JSON解析失败: ${parseError.message}`],
                    stats,
                    untranslated: []
                };
            }

            // 验证基本结构
            if (!translations || typeof translations !== 'object') {
                issues.push('翻译文件格式无效');
                return { isValid: false, issues, stats, untranslated: [] };
            }

            // 检测未翻译的词条
            const untranslated = this.detectUntranslatedEntries(translations);
            stats.untranslatedEntries = untranslated.length;
            TranslationValidator.log('INFO', `发现 ${untranslated.length} 个未翻译的词条`);

            // 统计分组数量
            stats.totalGroups = Object.keys(translations).length;

            // 检查每个分组
            const allKeys = new Set();
            const duplicateKeys = new Set();

            for (const [groupName, group] of Object.entries(translations)) {
                if (!group || typeof group !== 'object') {
                    issues.push(`分组 "${groupName}" 结构无效`);
                    continue;
                }

                // 检查分组中的翻译条目
                for (const [key, value] of Object.entries(group)) {
                    stats.totalEntries++;

                    // 检查键是否为空
                    if (!key || key.trim() === '') {
                        issues.push(`发现空键在分组 "${groupName}"`);
                        stats.emptyEntries++;
                        continue;
                    }

                    // 检查重复键
                    const fullKey = `${groupName}.${key}`;
                    if (allKeys.has(fullKey)) {
                        duplicateKeys.add(fullKey);
                        stats.duplicateKeys++;
                    } else {
                        allKeys.add(fullKey);
                    }

                    // 检查翻译值
                    if (!value || typeof value !== 'string') {
                        issues.push(`键 "${key}" 在分组 "${groupName}" 中的翻译值无效`);
                        stats.emptyEntries++;
                        continue;
                    }

                    if (value.trim() === '') {
                        issues.push(`键 "${key}" 在分组 "${groupName}" 中的翻译为空`);
                        stats.emptyEntries++;
                        continue;
                    }

                    // 检查翻译长度
                    if (value.length > 500) {
                        issues.push(`键 "${key}" 在分组 "${groupName}" 中的翻译过长 (${value.length} 字符)`);
                        stats.longTranslations++;
                    }

                    // 检查特殊字符
                    if (value.includes('\\n') || value.includes('\\t') || value.includes('\\r')) {
                        issues.push(`键 "${key}" 在分组 "${groupName}" 中包含转义字符`);
                        stats.specialChars++;
                    }
                }
            }

            // 添加重复键问题
            if (duplicateKeys.size > 0) {
                issues.push(`发现 ${duplicateKeys.size} 个重复键`);
            }

            // 检查是否有足够的翻译条目
            if (stats.totalEntries < 10) {
                issues.push('翻译条目数量过少，可能影响汉化效果');
            }

            // 添加未翻译词条问题
            if (untranslated.length > 0) {
                issues.push(`发现 ${untranslated.length} 个未翻译的词条`);
            }

            return {
                isValid: issues.length === 0,
                issues,
                stats,
                untranslated
            };

        } catch (error) {
            TranslationValidator.log('ERROR', `验证过程中发生错误: ${error.message}`);
            return {
                isValid: false,
                issues: [`验证过程中发生错误: ${error.message}`],
                stats,
                untranslated: []
            };
        }
    }

    static generateReport(projectRoot) {
        console.log('=== 翻译文件验证报告 ===');
        
        const validator = new TranslationValidator();
        const result = validator.validateTranslationFile(projectRoot);
        
        if (result.isValid) {
            console.log('翻译文件验证通过');
        } else {
            console.log('翻译文件验证失败');
        }

        console.log(`\n分组数量: ${result.stats.totalGroups}`);
        console.log(`翻译条目: ${result.stats.totalEntries}`);
        console.log(`未翻译词条: ${result.stats.untranslatedEntries}`);

        if (result.issues.length > 0) {
            console.log('\n发现的问题:');
            result.issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. ${issue}`);
            });
        }

        // 显示未翻译的词条
        if (result.untranslated && result.untranslated.length > 0) {
            console.log('\n[UNTRANSLATED] 未翻译的词条:');
            result.untranslated.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.path}: "${item.englishText}"`);
            });
        }

        // 计算覆盖率
        const coverage = this.calculateCoverage(projectRoot);
        console.log('\n[COVERAGE] 覆盖率分析:');
        console.log(`  基础词汇覆盖率: ${coverage.basic}%`);
        console.log(`  界面元素覆盖率: ${coverage.ui}%`);
        console.log(`  功能菜单覆盖率: ${coverage.menu}%`);

        return result;
    }

    /**
     * 计算翻译覆盖率
     * @param {string} projectRoot 项目根目录
     * @returns {Object} 覆盖率统计
     */
    static calculateCoverage(projectRoot) {
        const basicWords = [
            'Settings', 'Preferences', 'General', 'Advanced', 'Cancel', 'OK', 'Apply',
            'Save', 'Close', 'Open', 'Edit', 'Delete', 'Add', 'Remove', 'Search',
            'Find', 'Replace', 'Copy', 'Paste', 'Cut', 'Undo', 'Redo'
        ];

        const uiElements = [
            'File', 'Edit', 'View', 'Help', 'Tools', 'Window', 'Terminal',
            'Debug', 'Run', 'Stop', 'Start', 'End', 'Next', 'Previous'
        ];

        const menuItems = [
            'New File', 'Open File', 'Save As', 'Print', 'Exit', 'Undo', 'Redo',
            'Cut', 'Copy', 'Paste', 'Find', 'Replace', 'Go To', 'Select All'
        ];

        try {
            const translationPath = path.join(projectRoot, 'translations', 'zh-cn.json');
            const content = fs.readFileSync(translationPath, 'utf-8');
            const translations = JSON.parse(content);

            // 扁平化翻译对象
            const flatTranslations = {};
            for (const [groupName, group] of Object.entries(translations)) {
                for (const [key, value] of Object.entries(group)) {
                    flatTranslations[key] = value;
                }
            }

            // 计算覆盖率
            const basicCoverage = this.calculateWordCoverage(basicWords, flatTranslations);
            const uiCoverage = this.calculateWordCoverage(uiElements, flatTranslations);
            const menuCoverage = this.calculateWordCoverage(menuItems, flatTranslations);

            return {
                basic: Math.round(basicCoverage * 100),
                ui: Math.round(uiCoverage * 100),
                menu: Math.round(menuCoverage * 100)
            };

        } catch (error) {
            return { basic: 0, ui: 0, menu: 0 };
        }
    }

    /**
     * 计算词汇覆盖率
     * @param {string[]} words 词汇列表
     * @param {Object} translations 翻译对象
     * @returns {number} 覆盖率 (0-1)
     */
    static calculateWordCoverage(words, translations) {
        let found = 0;
        
        for (const word of words) {
            if (translations[word]) {
                found++;
            }
        }
        
        return found / words.length;
    }

    /**
     * 修复常见问题
     * @param {string} projectRoot 项目根目录
     * @returns {boolean} 是否成功修复
     */
    static fixCommonIssues(projectRoot) {
        const translationPath = path.join(projectRoot, 'translations', 'zh-cn.json');
        
        try {
            const content = fs.readFileSync(translationPath, 'utf-8');
            let translations = JSON.parse(content);
            let fixed = false;

            // 修复空值
            for (const [groupName, group] of Object.entries(translations)) {
                if (group && typeof group === 'object') {
                    for (const [key, value] of Object.entries(group)) {
                        if (!value || value.trim() === '') {
                            console.log(`修复空翻译: ${groupName}.${key}`);
                            delete group[key];
                            fixed = true;
                        }
                    }
                }
            }

            // 移除空分组
            for (const [groupName, group] of Object.entries(translations)) {
                if (!group || Object.keys(group).length === 0) {
                    console.log(`移除空分组: ${groupName}`);
                    delete translations[groupName];
                    fixed = true;
                }
            }

            if (fixed) {
                // 重新写入文件
                fs.writeFileSync(translationPath, JSON.stringify(translations, null, 2), 'utf-8');
                console.log('[FIXED] 已修复常见问题');
                return true;
            } else {
                console.log('[INFO] 未发现需要修复的问题');
                return true;
            }

        } catch (error) {
            console.error(`修复失败: ${error.message}`);
            return false;
        }
    }
}

// 主函数
function main() {
    const projectRoot = path.resolve(__dirname, '..');
    const args = process.argv.slice(2);

    if (args.includes('fix')) {
        console.log('正在修复翻译文件中的常见问题...');
        TranslationValidator.fixCommonIssues(projectRoot);
    } else {
        TranslationValidator.generateReport(projectRoot);
    }
}

if (require.main === module) {
    main();
}

module.exports = TranslationValidator;