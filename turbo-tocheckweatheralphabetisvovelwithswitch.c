#include<stdio.h>
#include<conio.h>

void main() {
    char ch;
    printf("Enter a character: ");
    scanf("%c", &ch);

    if((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
        printf("%c is an alphabet.\n", ch);
        switch(ch) {
            case 'A': case 'E': case 'I': case 'O': case 'U':
            case 'a': case 'e': case 'i': case 'o': case 'u':
                printf("%c is a vowel.\n", ch);
                break;
            default:
                printf("%c is a consonant.\n", ch);
        }
    } else {
        printf("%c is not an alphabet.\n", ch);
    }
}