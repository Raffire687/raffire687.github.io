// ==================== FIREBASE CONFIGURATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyCjk2uYHEsPnIT7sk-hIxKnNar-BaepHac",
    authDomain: "mobileposfinal-8e080.firebaseapp.com",
    databaseURL: "https://mobileposfinal-8e080-default-rtdb.firebaseio.com",
    projectId: "mobileposfinal-8e080",
    storageBucket: "mobileposfinal-8e080.appspot.com",
    messagingSenderId: "1075468764824",
    appId: "1:1075468764824:web:9c8a7b5f3d2e1a0b5c6d7e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==================== FIREBASE SERVICE ====================
const firebaseService = {
    currentTeacher: null,
    
    clearLocalData() {
        console.log('Clearing local teacher data');
    },

    // ==================== TEACHER AUTH ====================
    async registerTeacher(name, email, password) {
        try {
            const snapshot = await database.ref('teachers').orderByChild('email').equalTo(email).once('value');
            
            if (snapshot.exists()) {
                return { success: false, message: 'Email already registered' };
            }
            
            const teacherRef = await database.ref('teachers').push({
                name: name,
                email: email,
                password: password,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            return { success: true, teacherId: teacherRef.key };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: error.message };
        }
    },
    
    async loginTeacher(email, password) {
        try {
            const snapshot = await database.ref('teachers').orderByChild('email').equalTo(email).once('value');
            
            if (!snapshot.exists()) {
                return null;
            }
            
            let teacher = null;
            snapshot.forEach(child => {
                const data = child.val();
                if (data.password === password) {
                    teacher = {
                        id: child.key,
                        name: data.name,
                        email: data.email
                    };
                }
            });
            
            if (teacher) {
                this.currentTeacher = teacher;
            }
            
            return teacher;
        } catch (error) {
            console.error('Login error:', error);
            return null;
        }
    },
    
    // ==================== STUDENT MANAGEMENT ====================
    async getStudents() {
        try {
            if (!this.currentTeacher) return [];
            
            const snapshot = await database.ref(`teacher_data/${this.currentTeacher.id}/students`).once('value');
            const students = [];
            
            snapshot.forEach(child => {
                students.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            return students;
        } catch (error) {
            console.error('Error getting students:', error);
            return [];
        }
    },
    
    async getStudentAccounts() {
        try {
            const snapshot = await database.ref('student_accounts').once('value');
            const accounts = [];
            
            snapshot.forEach(child => {
                accounts.push({
                    studentId: child.key,
                    ...child.val()
                });
            });
            
            return accounts;
        } catch (error) {
            console.error('Error getting student accounts:', error);
            return [];
        }
    },
    
    async addStudent(name, username, password, yearLevel, section, selectedSubjects) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            const accountsSnapshot = await database.ref('student_accounts').orderByChild('username').equalTo(username).once('value');
            
            if (accountsSnapshot.exists()) {
                return { success: false, message: 'Username already exists' };
            }
            
            const year = new Date().getFullYear().toString().slice(-2);
            const randomNum = 200000 + Math.floor(Math.random() * 999);
            const studentIdNumber = `${year}-${randomNum}`;
            
            const studentRef = await database.ref(`teacher_data/${this.currentTeacher.id}/students`).push({
                name: name,
                studentIdNumber: studentIdNumber,
                yearLevel: yearLevel || 1,
                section: section || '',
                subjects: selectedSubjects.map(code => ({ subjectCode: code })),
                dateAdded: new Date().toISOString()
            });
            
            await database.ref(`student_accounts/${studentRef.key}`).set({
                username: username.toLowerCase(),
                password: password,
                name: name
            });
            
            await database.ref(`notifications/${studentRef.key}`).push({
                title: '🎉 Welcome!',
                message: `Your account has been created. Student ID: ${studentIdNumber}`,
                type: 'welcome',
                icon: '🎉',
                isRead: false,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                date: new Date().toISOString().split('T')[0]
            });
            
            return { success: true, studentId: studentRef.key, studentIdNumber: studentIdNumber };
        } catch (error) {
            console.error('Error adding student:', error);
            return { success: false, message: error.message };
        }
    },
    
    async updateStudent(studentId, name, username, password, yearLevel, section, selectedSubjects) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            const accountsSnapshot = await database.ref('student_accounts').orderByChild('username').equalTo(username).once('value');
            
            if (accountsSnapshot.exists()) {
                let usernameTaken = false;
                accountsSnapshot.forEach(child => {
                    if (child.key !== studentId) {
                        usernameTaken = true;
                    }
                });
                
                if (usernameTaken) {
                    return { success: false, message: 'Username already exists' };
                }
            }
            
            await database.ref(`teacher_data/${this.currentTeacher.id}/students/${studentId}`).update({
                name: name,
                yearLevel: yearLevel || 1,
                section: section || '',
                subjects: selectedSubjects.map(code => ({ subjectCode: code }))
            });
            
            await database.ref(`student_accounts/${studentId}`).update({
                username: username.toLowerCase(),
                password: password,
                name: name
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error updating student:', error);
            return { success: false, message: error.message };
        }
    },
    
    async deleteStudent(studentId) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            await database.ref(`teacher_data/${this.currentTeacher.id}/students/${studentId}`).remove();
            await database.ref(`student_accounts/${studentId}`).remove();
            await database.ref(`notifications/${studentId}`).remove();
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting student:', error);
            return { success: false, message: error.message };
        }
    },
    
    // ==================== SUBJECT MANAGEMENT ====================
    async getSubjects() {
        try {
            if (!this.currentTeacher) return [];
            
            const snapshot = await database.ref(`teacher_data/${this.currentTeacher.id}/subjects`).once('value');
            const subjects = [];
            
            snapshot.forEach(child => {
                subjects.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            return subjects;
        } catch (error) {
            console.error('Error getting subjects:', error);
            return [];
        }
    },
    
    async addSubject(code, name, schedule, room, units) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            const snapshot = await database.ref(`teacher_data/${this.currentTeacher.id}/subjects`).orderByChild('code').equalTo(code).once('value');
            
            if (snapshot.exists()) {
                return { success: false, message: 'Subject code already exists' };
            }
            
            await database.ref(`teacher_data/${this.currentTeacher.id}/subjects`).push({
                code: code,
                name: name,
                schedule: schedule || 'TBA',
                room: room || 'TBA',
                units: units || 3
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error adding subject:', error);
            return { success: false, message: error.message };
        }
    },
    
    async updateSubject(subjectId, code, name, schedule, room, units) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            await database.ref(`teacher_data/${this.currentTeacher.id}/subjects/${subjectId}`).update({
                code: code,
                name: name,
                schedule: schedule || 'TBA',
                room: room || 'TBA',
                units: units || 3
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error updating subject:', error);
            return { success: false, message: error.message };
        }
    },
    
    async deleteSubject(subjectId) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            await database.ref(`teacher_data/${this.currentTeacher.id}/subjects/${subjectId}`).remove();
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting subject:', error);
            return { success: false, message: error.message };
        }
    },
    
    // ==================== FIXED ATTENDANCE MANAGEMENT ====================
    async getAttendance(date) {
        try {
            if (!this.currentTeacher) return {};
            
            const snapshot = await database.ref(`teacher_data/${this.currentTeacher.id}/attendance/${date}`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Error getting attendance:', error);
            return {};
        }
    },
    
    async updateAttendance(studentId, studentName, date, subjectCode, status) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            await database.ref(`teacher_data/${this.currentTeacher.id}/attendance/${date}/${studentId}/${subjectCode}`).set({
                status: status,
                time: time,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                studentName: studentName
            });
            
            await database.ref(`attendance/${date}/${studentId}/${subjectCode}`).set({
                status: status,
                time: time,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                studentName: studentName,
                subjectCode: subjectCode
            });
            
            let subjectName = subjectCode;
            const subjects = await this.getSubjects();
            const subject = subjects.find(s => s.code === subjectCode);
            if (subject) {
                subjectName = subject.name;
            }
            
            const now = new Date();
            const notificationData = {
                title: status === 'present' ? '✅ Present' : status === 'absent' ? '❌ Absent' : '⏰ Late',
                message: `${studentName} was marked ${status} in ${subjectCode} - ${subjectName}`,
                type: status,
                icon: status === 'present' ? '✅' : status === 'absent' ? '❌' : '⏰',
                subjectCode: subjectCode,
                subjectName: subjectName,
                time: time,
                isRead: false,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                date: now.toISOString().split('T')[0]
            };
            
            await database.ref(`notifications/${studentId}`).push(notificationData);
            
            return { success: true };
        } catch (error) {
            console.error('Error updating attendance:', error);
            return { success: false, message: error.message };
        }
    },
    
    async markAllStudents(date, subjectCode, studentsList, status) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            let subjectName = subjectCode;
            const subjects = await this.getSubjects();
            const subject = subjects.find(s => s.code === subjectCode);
            if (subject) {
                subjectName = subject.name;
            }
            
            const now = new Date();
            let count = 0;
            
            for (const student of studentsList) {
                await database.ref(`teacher_data/${this.currentTeacher.id}/attendance/${date}/${student.id}/${subjectCode}`).set({
                    status: status,
                    time: time,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    studentName: student.name
                });
                
                await database.ref(`attendance/${date}/${student.id}/${subjectCode}`).set({
                    status: status,
                    time: time,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    studentName: student.name,
                    subjectCode: subjectCode
                });
                
                const notificationData = {
                    title: status === 'present' ? '✅ Present' : status === 'absent' ? '❌ Absent' : '⏰ Late',
                    message: `${student.name} was marked ${status} in ${subjectCode} - ${subjectName}`,
                    type: status,
                    icon: status === 'present' ? '✅' : status === 'absent' ? '❌' : '⏰',
                    subjectCode: subjectCode,
                    subjectName: subjectName,
                    time: time,
                    isRead: false,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    date: now.toISOString().split('T')[0]
                };
                
                await database.ref(`notifications/${student.id}`).push(notificationData);
                count++;
            }
            
            return { success: true, count: count };
        } catch (error) {
            console.error('Error marking all students:', error);
            return { success: false, message: error.message };
        }
    },
    
    // ==================== NOTIFICATIONS ====================
    async pushAnnouncement(subjectCode, subjectName, message, enrolledStudents) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            let count = 0;
            const now = new Date();
            
            for (const student of enrolledStudents) {
                await database.ref(`notifications/${student.id}`).push({
                    title: `📢 Announcement: ${subjectCode}`,
                    message: message,
                    type: 'announcement',
                    icon: '📢',
                    subjectCode: subjectCode,
                    subjectName: subjectName,
                    isRead: false,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    date: now.toISOString().split('T')[0]
                });
                count++;
            }
            
            return { success: true, count: count };
        } catch (error) {
            console.error('Error pushing announcement:', error);
            return { success: false, message: error.message };
        }
    },
    
    async pushPersonalNotification(studentId, studentName, message) {
        try {
            if (!this.currentTeacher) {
                return { success: false, message: 'No teacher logged in' };
            }
            
            const now = new Date();
            
            await database.ref(`notifications/${studentId}`).push({
                title: `📌 Personal Message`,
                message: message,
                type: 'personal',
                icon: '📌',
                isRead: false,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                date: now.toISOString().split('T')[0]
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error pushing personal notification:', error);
            return { success: false, message: error.message };
        }
    },
    
    // ==================== REPORTS ====================
    async generateReport(startDate, endDate, subjectFilter = '') {
        try {
            if (!this.currentTeacher) return [];
            
            const report = [];
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                
                const snapshot = await database.ref(`teacher_data/${this.currentTeacher.id}/attendance/${dateStr}`).once('value');
                const dayData = snapshot.val();
                
                if (dayData) {
                    for (const studentId in dayData) {
                        for (const subjectCode in dayData[studentId]) {
                            if (!subjectFilter || subjectCode === subjectFilter) {
                                const record = dayData[studentId][subjectCode];
                                
                                let existingDay = report.find(r => r.date === dateStr && r.subject === subjectCode);
                                
                                if (!existingDay) {
                                    existingDay = {
                                        date: dateStr,
                                        subject: subjectCode,
                                        present: 0,
                                        absent: 0,
                                        late: 0,
                                        total: 0
                                    };
                                    report.push(existingDay);
                                }
                                
                                if (record.status === 'present') existingDay.present++;
                                else if (record.status === 'absent') existingDay.absent++;
                                else if (record.status === 'late') existingDay.late++;
                                existingDay.total++;
                            }
                        }
                    }
                }
            }
            
            return report.sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            console.error('Error generating report:', error);
            return [];
        }
    }
};
